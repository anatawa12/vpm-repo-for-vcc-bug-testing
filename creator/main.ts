import * as zipjs from "https://deno.land/x/zipjs@v2.7.32/index.js?dts";

const base_url = "https://anatawa12.github.io/vpm-repo-for-vcc-bug-testing/";
const out_dir = "dist";
const src_dir = "src";
const repo_name = "Anatawa12's Test VPM Repository for VCC's bug";

async function main() {
  try {
    await Deno.remove(out_dir, {recursive: true});
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw err;
    }
  }
  await Deno.mkdir(out_dir, {recursive: true});

  let error = false;

  const repository: Repository = {
    name: repo_name,
    author: "anatawa12",
    url: `${base_url}index.json`,
    id: "io.github.anataw12.vpm-repo-for-vcc-bug-testing",
    packages: {},
  }

  let promises: Promise<void>[] = [];
  for await (const dirEntry of Deno.readDir(src_dir)) {
    if (dirEntry.isDirectory) {
      console.log(`skipping directory ${dirEntry.name}`);
      continue
    }

    if (!dirEntry.name.endsWith(".json")) {
      console.log(`skipping non json ${dirEntry.name}`);
      continue
    }

    promises.push((async () => {
      try {
        await processFile(repository, dirEntry.name);
      } catch (e) {
        console.log(`error processing ${dirEntry.name}`);
        console.error(e);
        error = true;
      }
    })());
  }

  await Promise.all(promises);

  if (error) throw new Error("there are error. see above");

  await Deno.writeTextFile(`${out_dir}/index.json`, JSON.stringify(repository));
  await Deno.writeTextFile(`${out_dir}/index.html`, await createIndexHtml(repository));
}

async function processFile(repository: Repository, name: string) {
  const zipName = name.replace(".json", "") + ".zip";

  // load package.json
  const jsonText = await Deno.readTextFile(`${src_dir}/${name}`);
  const json = JSON.parse(jsonText);

  if (typeof json.name !== "string") throw new Error("name is not defined");
  if (typeof json.version !== "string") throw new Error("version is not defined");

  const packageId: string = json.name;
  const packageVersion: string = json.version;

  json.url = `${base_url}${zipName}`

  const packageInfo = repository.packages[packageId] ??= { versions: {} };
  packageInfo.versions[packageVersion] = json;

  // create zip file
  const zipStream = await Deno.create(`${out_dir}/${zipName}`);
  const zip = new zipjs.ZipWriter(zipStream.writable);
  await zip.add("package.json", new zipjs.BlobReader(new Blob([new TextEncoder().encode(jsonText)])));
  await zip.close();
}

async function createIndexHtml(repository: Repository): Promise<string> {
  const template = await Deno.readTextFile("creator/index.template.html");
  let packageList = "";
  for (const [_packageId, packageInfo] of Object.entries(repository.packages)) {
    for (const packageJson of Object.values(packageInfo.versions)) {
      packageJson.name
      packageList += `<li>${packageJson.displayName ?? packageJson.name} version ${packageJson.version} (<a href="${packageJson.url}">direct link</a>)</li>\n`;
    }
  }
  return template.replaceAll("${name}", repository.name).replaceAll("${package-list}", packageList);
}

interface Repository {
  name: string;
  author: string;
  url: string;
  id: string;
  packages: {
    [packageId: string]: {
      versions: {
        [version: string]: object & {
          url: string;
          name: string;
          version: string;
          displayName?: string;
        };
      }
    }
  };
}

await main();
