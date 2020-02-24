import * as path from 'path';
import { BUNDLE_RUNTIME_NAMES } from '../bundleRuntime/bundleRuntimeCore';
import { Context } from '../core/context';
import { env } from '../env';
import { ensureAbsolutePath, pathJoin, readFile } from '../utils/utils';
import { findTsConfig } from './findTSConfig';
import { ICompilerOptions, IRawCompilerOptions } from './interfaces';
import { parseTypescriptConfig } from './parseTypescriptConfig';
import { normalize, dirname } from 'path';
import { parseJsonSourceFileConfigFileContent, parseJsonText, ParseConfigHost } from 'typescript';
import ts = require('typescript');
export function createCompilerOptions(ctx: Context): ICompilerOptions {
  let options = ctx.config.compilerOptions || {};

  if (!options.jsxFactory) options.jsxFactory = 'React.createElement';
  if (options.esModuleInterop === undefined) options.esModuleInterop = true;
  if (options.esModuleStatement === undefined) options.esModuleStatement = true;
  options.processEnv = ctx.config.env;
  options.buildTarget = ctx.config.target;

  if (!options.jsParser) options.jsParser = {};
  if (!options.jsParser.nodeModules) options.jsParser.nodeModules = 'meriyah';
  if (!options.jsParser.project) options.jsParser.project = 'ts';

  let tsConfigPath;

  // setting up a path to the user specific tsconfig.json
  if (options.tsConfig) {
    if (typeof options.tsConfig !== 'string') {
      throw new Error('tsConfig accepts a path only');
    }
    tsConfigPath = ensureAbsolutePath(options.tsConfig, env.SCRIPT_PATH);
  } else {
    const fileName = ctx.config.entries[0];
    tsConfigPath = findTsConfig({ fileName: fileName, root: env.APP_ROOT });
  }

  let baseURL = options.baseUrl;
  let tsConfigDirectory;
  if (tsConfigPath) {
    const data = parseTypescriptConfig(tsConfigPath);

    tsConfigDirectory = path.dirname(tsConfigPath);
    const tsConfig = data.config;

    if (data.error) {
      let message = 'Error while initializing tsconfig';
      ctx.fatal('tsconfig error', [data.error.messageText || message]);
    }

    if (tsConfig) {
      let tsConfigCompilerOptions: IRawCompilerOptions = {};
      if (tsConfig.compilerOptions) {
        tsConfigCompilerOptions = tsConfig.compilerOptions;

        if (tsConfigCompilerOptions.baseUrl) {
          baseURL = tsConfigCompilerOptions.baseUrl;
        }
      }
      if (tsConfig.extends) {
        const targetExtendedFile = path.join(tsConfigDirectory, tsConfig.extends);

        const extendedData = parseTypescriptConfig(targetExtendedFile);

        if (extendedData.error) {
          let message = 'Error while initializing tsconfig';
          ctx.fatal('tsconfig extends error', [data.error.messageText || message]);
        }
        if (extendedData.config) {
          if (extendedData.config.compilerOptions) {
            if (extendedData.config.compilerOptions.baseUrl && !baseURL) {
              tsConfigDirectory = path.dirname(targetExtendedFile);
              baseURL = extendedData.config.compilerOptions.baseUrl;
            }
            for (const key in extendedData.config.compilerOptions) {
              tsConfigCompilerOptions[key] = extendedData.config.compilerOptions[key];
            }
          }
        }
      }

      if (tsConfig.compilerOptions) {
        const tsConfigCompilerOptions = tsConfig.compilerOptions;

        if (tsConfigCompilerOptions.paths) options.paths = tsConfigCompilerOptions.paths;

        // to keep it compatible with the old versions
        if (tsConfigCompilerOptions.allowSyntheticDefaultImports) options.esModuleInterop = true;

        // esModuleInterop has more weight over allowSyntheticDefaultImports
        if (tsConfigCompilerOptions.esModuleInterop !== undefined)
          options.esModuleInterop = tsConfigCompilerOptions.esModuleInterop;

        if (tsConfigCompilerOptions.experimentalDecorators !== undefined)
          options.experimentalDecorators = tsConfigCompilerOptions.experimentalDecorators;

        if (tsConfigCompilerOptions.emitDecoratorMetadata !== undefined)
          options.emitDecoratorMetadata = tsConfigCompilerOptions.emitDecoratorMetadata;

        if (tsConfigCompilerOptions.jsxFactory) options.jsxFactory = tsConfigCompilerOptions.jsxFactory;
      }

      // import the references, translating all paths to absolute
      options.tsReferences = tsConfig.references?.filter(ref => ref.path).map(ref => ({
        ...ref,
        path: ensureAbsolutePath(ref.path, dirname(tsConfigPath)),
      }))
    }
  }
  if (baseURL) options.baseUrl = path.resolve(tsConfigDirectory, baseURL);

  if (options.buildEnv === undefined) {
    options.buildEnv = {};
  }

  // set default helplers
  options.buildEnv.require = BUNDLE_RUNTIME_NAMES.GLOBAL_OBJ + '.' + BUNDLE_RUNTIME_NAMES.REQUIRE_FUNCTION;
  options.buildEnv.cachedModules = BUNDLE_RUNTIME_NAMES.GLOBAL_OBJ + '.' + BUNDLE_RUNTIME_NAMES.CACHE_MODULES;
  return options;
}

type InOutMap = { input: string, output: string }

interface TsConfigReferences {
  path: string,
  files: InOutMap[],
  references: readonly ts.ProjectReference[],
}

// Parse the extensions that Typescript will copy to the output directory
function parseTsExtension(file: string): { stem: string, ext: string } {
  const match = /(.*)((.tsx$)|(\.ts$)|(.json$))/.exec(file);
  return match ? { stem: match[1], ext: match[2] } : { stem: file, ext: "" };
}

const tsOutExts = {
  ".ts": [".js", ".d.ts", ".js.map", ".d.ts.map"],
  ".tsx": [".jsx", ".d.ts", ".jsx.map", ".d.ts.map"],
}

function calculateInOutMap(rootDir: string, outDir: string, input: string): InOutMap[] {
  const nroot = normalize(rootDir);
  const nout = normalize(outDir);
  const ninput = normalize(input);
  if (!ninput.startsWith(nroot)) {
    // If you have an outDir of "dist/"
    // And you have a rootDir of "src/"
    // This makes src/X.ts map to dist/X.js
    // But then if you include things outside of "src/" what happens
    // E.g. where does typescript put the output of "other/X.ts" go?
    throw new Error("TODO: figure out how to deal with files that are included outside of the root directory");
  }
  // strip the root part to get the relative part
  const relInput = ninput.substr(nroot.length);
  const { stem, ext } = parseTsExtension(relInput);
  const outExts = tsOutExts[ext] || [];
  return outExts.map(outExt => ({
    input: ninput,
    output: pathJoin(nout, `${stem}${outExt}`),
  }))
}

function loadTsConfig(path: string, host: ParseConfigHost): TsConfigReferences | undefined {
  const byFolder = (!/tsconfig.json$/.test(path)) && loadTsConfig(pathJoin(path, "tsconfig.json"), host);
  if (byFolder)
    return byFolder;
  try {
    const normalized = normalize(path);
    const raw = readFile(normalized);

    const tsconfig = parseJsonText(normalized, raw);
    const files = parseJsonSourceFileConfigFileContent(tsconfig, host, dirname(normalized));
    return {
      path: normalized,
      files: files.fileNames
        .map(input => calculateInOutMap(files.options.rootDir, files.options.outDir, input))
        // flatten
        .reduce((acc, val) => acc.concat(val), []),
      references: files.projectReferences,
    }
  }
  catch (e) {
    // not being able to load the reference is not fatal
    // and is even normal in some circumstances
    return undefined;
  }
}

export function recurseTsReferences(ctx: Context): Map<string, string> {
  const tsHost = ctx.getTsParseConfigHost();
  const map = new Map<string, string>();
  const anticycle = new Set<string>();
  const rawReferences = ctx.compilerOptions.tsReferences || [];
  for (const rawRef of rawReferences) {
    const { path: rawPath } = rawRef;
    if (!rawPath)
      continue;
    recurseTsReference(ctx, tsHost, rawPath, map, anticycle);
  }
  return map;
}

function recurseTsReference(ctx: Context, tsHost: ParseConfigHost, reference: string, map: Map<string, string>, anticycle: Set<string>) {
  const result = loadTsConfig(reference, tsHost);
  if (!result)
    return;
  const { path, files, references } = result;
  if (anticycle.has(path))
    return; // we've already been to this one
  anticycle.add(path); // guard against infinite recursion
  for (const file of files) {
    if (map.has(file.output)) {
      const existing = map.get(file.output);
      throw new Error(`Multiple input files map to same output file (1. "${existing}", 2. "${file.input}") => ("${file.output}")`);
    }
    map.set(file.output, file.input);
  }
  for (const subref of (references || [])) {
    recurseTsReference(ctx, tsHost, subref.path, map, anticycle);
  }

}