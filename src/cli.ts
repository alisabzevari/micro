#!/usr/bin/env node

// Native
import path from "path";
import { existsSync } from "fs";

// Packages
import arg from "arg";
import chalk from "chalk";

// Utilities
import { micro } from ".";
import { handle } from "./handler";
const { version } = require("../package");
import { logError } from "./error";
import { parseEndpoint } from "./parse-endpoint";

// Check if the user defined any options
const args = arg({
	"--listen": [parseEndpoint],
	"-l": "--listen",

	"--help": Boolean,

	"--version": Boolean,
	"-v": "--version",

	// Deprecated options
	"--port": Number,
	"-p": "--port",
	"--host": String,
	"-h": "--host",
	"--unix-socket": String,
	"-s": "--unix-socket"
});

// When `-h` or `--help` are used, print out
// the usage information
if (args["--help"]) {
	console.error(chalk`
  {bold.cyan micro} - Asynchronous HTTP microservices

  {bold USAGE}

      {bold $} {cyan micro} --help
      {bold $} {cyan micro} --version
      {bold $} {cyan micro} [-l {underline listen_uri} [-l ...]] [{underline entry_point.js}]

      By default {cyan micro} will listen on {bold 0.0.0.0:3000} and will look first
      for the {bold "main"} property in package.json and subsequently for {bold index.js}
      as the default {underline entry_point}.

      Specifying a single {bold --listen} argument will overwrite the default, not supplement it.

  {bold OPTIONS}

      --help                              shows this help message

      -v, --version                       displays the current version of micro

      -l, --listen {underline listen_uri}             specify a URI endpoint on which to listen (see below) -
                                          more than one may be specified to listen in multiple places

  {bold ENDPOINTS}

      Listen endpoints (specified by the {bold --listen} or {bold -l} options above) instruct {cyan micro}
      to listen on one or more interfaces/ports, UNIX domain sockets, or Windows named pipes.

      For TCP (traditional host/port) endpoints:

          {bold $} {cyan micro} -l tcp://{underline hostname}:{underline 1234}

      For UNIX domain socket endpoints:

          {bold $} {cyan micro} -l unix:{underline /path/to/socket.sock}

      For Windows named pipe endpoints:

          {bold $} {cyan micro} -l pipe:\\\\.\\pipe\\{underline PipeName}
`);
	process.exit(2);
}

// Print out the package's version when
// `--version` or `-v` are used
if (args["--version"]) {
	console.log(version);
	process.exit();
}

if ((args["--port"] || args["--host"]) && args["--unix-socket"]) {
	logError(
		`Both host/port and socket provided. You can only use one.`,
		"invalid-port-socket"
	);
	process.exit(1);
}

let deprecatedEndpoint = null;

args["--listen"] = args["--listen"] || [];

if (args["--port"]) {
	const { isNaN } = Number;
	const port = Number(args["--port"]);
	if (
		isNaN(port) ||
		(!isNaN(port) && (port < 1 || port >= Math.pow(2, 16)))
	) {
		logError(
			`Port option must be a number. Supplied: ${args["--port"]}`,
			"invalid-server-port"
		);
		process.exit(1);
	}

	deprecatedEndpoint = [args["--port"]];
}

if (args["--host"]) {
	deprecatedEndpoint = deprecatedEndpoint || [];
	deprecatedEndpoint.push(args["--host"]);
}

if (deprecatedEndpoint) {
	args["--listen"].push(deprecatedEndpoint);
}

if (args["--unix-socket"]) {
	if (typeof args["--unix-socket"] === "boolean") {
		logError(
			`Socket must be a string. A boolean was provided.`,
			"invalid-socket"
		);
	}
	args["--listen"].push(args["--unix-socket"]);
}

if (args["--port"] || args["--host"] || args["--unix-socket"]) {
	logError(
		"--port, --host, and --unix-socket are deprecated - see --help for information on the --listen flag",
		"deprecated-endpoint-flags"
	);
}

if (args["--listen"].length === 0) {
	// default endpoint
	args["--listen"].push([3000]);
}

let file = args._[0];

if (!file) {
	try {
		const packageJson = require(path.resolve(
			process.cwd(),
			"package.json"
		));
		file = packageJson.main || "index.js";
	} catch (err) {
		if (err.code !== "MODULE_NOT_FOUND") {
			logError(
				`Could not read \`package.json\`: ${err.message}`,
				"invalid-package-json"
			);
			process.exit(1);
		}
	}
}

if (!file) {
	logError("Please supply a file!", "path-missing");
	process.exit(1);
}

if (file[0] !== "/") {
	file = path.resolve(process.cwd(), file);
}

if (!existsSync(file)) {
	logError(
		`The file or directory "${path.basename(file)}" doesn't exist!`,
		"path-not-existent"
	);
	process.exit(1);
}

function registerShutdown(fn) {
	let run = false;

	const wrapper = () => {
		if (!run) {
			run = true;
			fn();
		}
	};

	process.on("SIGINT", wrapper);
	process.on("SIGTERM", wrapper);
	process.on("exit", wrapper);
}

function startEndpoint(module, endpoint) {
	const server = micro(module);

	server.on("error", err => {
		console.error("micro:", err.stack);
		process.exit(1);
	});

	server.listen(...endpoint, () => {
		const details = server.address();

		registerShutdown(() => server.close());

		// `micro` is designed to run only in production, so
		// this message is perfectly for prod
		if (typeof details === "string") {
			console.log(`micro: Accepting connections on ${details}`);
		} else if (typeof details === "object" && details.port) {
			console.log(`micro: Accepting connections on port ${details.port}`);
		} else {
			console.log("micro: Accepting connections");
		}
	});
}

async function start() {
	const loadedModule = await handle(file);

	for (const endpoint of args["--listen"]) {
		startEndpoint(loadedModule, endpoint);
	}

	registerShutdown(() =>
		console.log("micro: Gracefully shutting down. Please wait...")
	);
}

start();
