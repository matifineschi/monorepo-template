import type { PlopTypes } from "@turbo/gen";

type PackageGenData = {
	name: string;
	pathPrefix: "packages" | "packages/infra";
	needsEnv: boolean;
	turbo: { paths: { root: string } };
};

export default function generator(plop: PlopTypes.NodePlopAPI): void {
	plop.setGenerator("package", {
		description:
			"Internal workspace package under packages/ or packages/infra/ (Biome + bun test, source-only exports)",
		prompts: [
			{
				type: "list",
				name: "pathPrefix",
				message: "Package location:",
				default: "packages",
				choices: [
					{
						name: "packages/<name> (top-level workspace package)",
						value: "packages",
					},
					{
						name: "packages/infra/<name> (owns a connection to an external system)",
						value: "packages/infra",
					},
				],
			},
			{
				type: "input",
				name: "name",
				message: "Package directory name (e.g. ui, queue):",
				validate: (input: string) => {
					if (!input.trim()) {
						return "name is required";
					}
					if (!/^[a-z0-9][-a-z0-9]*$/i.test(input)) {
						return "use letters, numbers, and hyphens only";
					}
					return true;
				},
			},
			{
				// Asked rather than always generated: most packages read no env, and an
				// empty createEnv plus three unused deps is noise knip would flag. The
				// prompt is how the convention gets taught, at the moment it's relevant.
				type: "confirm",
				name: "needsEnv",
				message: "Does this package read environment variables?",
				default: false,
			},
		],
		actions: (data) => {
			const { name, pathPrefix, needsEnv, turbo } = data as PackageGenData;
			const root = turbo.paths.root;
			const dir = `${root}/${pathPrefix}/${name}`;
			const camelName = name.replace(/-([a-z0-9])/g, (_, char: string) =>
				char.toUpperCase(),
			);

			const actions: PlopTypes.ActionType[] = [
				{
					type: "add",
					path: `${dir}/package.json`,
					templateFile: "templates/package.json.hbs",
				},
				{
					type: "add",
					path: `${dir}/tsconfig.json`,
					templateFile: "templates/tsconfig.json.hbs",
				},
				{
					type: "add",
					path: `${dir}/README.md`,
					templateFile: "templates/README.md.hbs",
					data: { pathPrefix },
				},
				{
					type: "add",
					path: `${dir}/src/index.ts`,
					template: "export {};\n",
				},
				// Test scaffolding always ships: it is a handful of lines, always
				// correct, and means a package generated on day 40 is covered by
				// `turbo run test` from birth rather than whenever someone remembers.
				{
					type: "add",
					path: `${dir}/bunfig.toml`,
					templateFile: "templates/bunfig.toml.hbs",
				},
				{
					type: "add",
					path: `${dir}/test-setup.ts`,
					templateFile: "templates/test-setup.ts.hbs",
				},
				{
					type: "add",
					path: `${dir}/src/__tests__/index.test.ts`,
					templateFile: "templates/index.test.ts.hbs",
				},
			];

			if (needsEnv) {
				actions.push({
					type: "add",
					path: `${dir}/src/env.ts`,
					templateFile: "templates/env.ts.hbs",
					data: { camelName },
				});
			}

			return actions;
		},
	});
}
