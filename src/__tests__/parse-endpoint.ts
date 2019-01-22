import { parseEndpoint } from "../parse-endpoint";

test("parses TCP URI", () => {
	expect(parseEndpoint("tcp://my-host-name.foo.bar:12345")).toEqual({
		port: 12345,
		host: "my-host-name.foo.bar"
	});
	expect(parseEndpoint("tcp://0.0.0.0:8080")).toEqual({port: 8080, host: "0.0.0.0"});

	// with the default
	expect(parseEndpoint("tcp://1.2.3.4")).toEqual({port: 3000, host: "1.2.3.4"});
});

test("parses UNIX domain socket URI", () => {
	expect(parseEndpoint("unix:/foo/bar.sock")).toEqual({path: "/foo/bar.sock"});
	expect(parseEndpoint("unix:///foo/bar.sock")).toEqual({path: "/foo/bar.sock"});
});

test("parses Windows named pipe URI", () => {
	expect(parseEndpoint("pipe:\\\\.\\pipe\\some-name")).toEqual({
		path: "\\\\.\\pipe\\some-name"
	});
});

test("throws on invalid URI", () => {
	expect(() => parseEndpoint("qwertyuiop")).toThrow(
		"Invalid URL: qwertyuiop"
	);
	expect(() => parseEndpoint("tcp://:8080")).toThrow(
		"Invalid URL: tcp://:8080"
	);
});

test("throws on invalid scheme (protocol)", () => {
	expect(() => parseEndpoint("foobar://blah")).toThrow(
		"Unknown --listen endpoint scheme (protocol): foobar:"
	);
});

test("throws on invalid Windows named pipe", () => {
	expect(() => parseEndpoint("pipe:lolsickbro")).toThrow(
		"Invalid Windows named pipe endpoint: pipe:lolsickbro"
	);
	expect(() => parseEndpoint("pipe://./pipe/lol")).toThrow(
		"Invalid Windows named pipe endpoint: pipe://./pipe/lol"
	);
});

test("throws on invalid UNIX domain socket", () => {
	expect(() => parseEndpoint("unix:")).toThrow(
		"Invalid UNIX domain socket endpoint: unix:"
	);
});
