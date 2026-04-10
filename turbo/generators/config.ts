import type { PlopTypes } from "@turbo/gen";

type PackageGenData = {
	name: string;
	pathPrefix: "packages" | "packages/infra";
	turbo: { paths: { root: string } };
};

export default function generator(plop: PlopTypes.NodePlopAPI): void {
	plop.setGenerator("package", {
		description: "Internal workspace package under packages/ or packages/infra/ (Biome + tsc library layout)",
		prompts: [
			{
				type: "list",
				name: "pathPrefix",
				message: "Package location:",
				default: "packages",
				choices: [
					{ name: "packages/<name> (top-level workspace package)", value: "packages" },
					{ name: "packages/infra/<name> (infra workspace package)", value: "packages/infra" },
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
		],
		actions: (data) => {
			const { name, pathPrefix, turbo } = data as PackageGenData;
			const root = turbo.paths.root;
			const dir = `${root}/${pathPrefix}/${name}`;
			const tsconfigExtends =
				pathPrefix === "packages/infra" ? "../../typescript-config/base.json" : "../typescript-config/base.json";

			return [
				{
					type: "add",
					path: `${dir}/package.json`,
					templateFile: "templates/package.json.hbs",
				},
				{
					type: "add",
					path: `${dir}/tsconfig.json`,
					templateFile: "templates/tsconfig.json.hbs",
					data: { tsconfigExtends },
				},
				{
					type: "add",
					path: `${dir}/biome.json`,
					templateFile: "templates/biome.json.hbs",
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
			];
		},
	});
}
