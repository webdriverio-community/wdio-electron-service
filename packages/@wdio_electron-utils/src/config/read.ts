import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function readConfig(configFile: string, projectDir: string) {
  const configFilePath = path.join(projectDir, configFile);
  await fs.access(configFilePath, fs.constants.R_OK);

  const ext = path.parse(configFile).ext;
  const extRegex = {
    js: /\.(c|m)?(j|t)s$/,
    json: /\.json(5)?$/,
    toml: /\.toml$/,
    yaml: /\.y(a)?ml$/,
  };

  let result: unknown;

  if (extRegex.js.test(ext)) {
    const { tsImport } = await import('tsx/esm/api');
    const configFilePathUrl = pathToFileURL(configFilePath).toString();
    const readResult = (await tsImport(configFilePathUrl, __filename)).default;

    if (typeof readResult === 'function') {
      result = readResult();
    } else {
      result = readResult;
    }
    result = await Promise.resolve(result);
  } else {
    const data = await fs.readFile(configFilePath, 'utf8');
    if (extRegex.json.test(ext)) {
      const json5 = await import('json5');
      // JSON5 exports parse as default in ESM, but as a named export in CJS
      // https://github.com/json5/json5/issues/240
      const parseJson = json5.parse || json5.default.parse;
      result = parseJson(data);
    } else if (extRegex.toml.test(ext)) {
      result = (await import('smol-toml')).parse(data);
    } else if (extRegex.yaml.test(ext)) {
      result = (await import('yaml')).parse(data);
    }
  }
  return { result, configFile };
}
