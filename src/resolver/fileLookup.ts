import * as fs from 'fs';
import * as path from 'path';
import { IRawCompilerOptions } from '../compilerOptions/interfaces';
import { parseTypescriptConfig } from '../compilerOptions/parseTypescriptConfig';
// import { initTypescriptConfig } from '../tsconfig/configParser';
import { fileExists } from '../utils/utils';
import { getFolderEntryPointFromPackageJSON } from './shared';

export interface ILookupProps {
  fileDir?: string;
  filePath?: string;
  isDev?: boolean;
  javascriptFirst?: boolean;
  target: string;
  typescriptFirst?: boolean;
  targetMap?: Map<string, string>;
}

export interface TsConfigAtPath {
  absPath: string;
  compilerOptions: IRawCompilerOptions;
  tsconfigPath: string;
}

export interface ILookupResult {
  absPath: string;
  customIndex?: boolean;
  extension?: string;
  fileExists: boolean;
  isDirectoryIndex?: boolean;
  monorepoModulesPaths?: string;
  tsConfigAtPath?: TsConfigAtPath;
}

const JS_INDEXES = ['index.js', 'index.jsx'];
const TS_INDEXES = ['index.ts', 'index.tsx'];
const TS_INDEXES_FIRST = [...TS_INDEXES, ...JS_INDEXES];
const JS_INDEXES_FIRST = [...JS_INDEXES, ...TS_INDEXES];

const JS_EXTENSIONS = ['.js', '.jsx', '.mjs'];
const TS_EXTENSIONS = ['.ts', '.tsx'];

const TS_EXTENSIONS_FIRST = [...TS_EXTENSIONS, ...JS_EXTENSIONS];
const JS_EXTENSIONS_FIRST = [...JS_EXTENSIONS, ...TS_EXTENSIONS];

function tryDirect(target: string, find: (path: string) => string) {
  return find(target);
}

function tryIndexes(target: string, indexes: Array<string>, find: (path: string) => string | undefined) {
  for (const i in indexes) {
    const indexFile = indexes[i];
    const resolved = path.join(target, indexFile);
    const found = find(resolved);
    if (found) {
      return found;
    }
  }
}

function tryExtensions(target: string, extensions: Array<string>, find: (path: string) => string | undefined) {
  for (const i in extensions) {
    const resolved = `${target}${extensions[i]}`;
    const found = find(resolved);
    if (found) {
      return found;
    }
  }
}

function findMappedFile(file: string, map?: Map<string, string>): string | undefined {
  const mapped = map?.get(file);
  if (mapped && mapped !== file) {
    return findMappedFile(mapped, undefined);
  }
  try {
    const stat = fs.lstatSync(file);
    return stat.isFile() ? file : undefined;
  }
  catch {
    return undefined;
  }
}

function findMappedPath(path: string, map?: Map<string, string>): string | undefined {
  const mapped = map?.get(path);
  if (mapped && mapped !== path) {
    return findMappedPath(mapped, undefined);
  }
  return fileExists(path) ? path : undefined;
}

export function fileLookup(props: ILookupProps): ILookupResult {
  if (!props.fileDir && !props.filePath) {
    throw new Error('Failed to lookup. Provide either fileDir or filePath');
  }
  let resolved = path.join(props.filePath ? path.dirname(props.filePath) : props.fileDir, props.target);
  const extension = path.extname(resolved);

  const map = props.targetMap;
  const findFile = file => findMappedFile(file, map);
  const findPath = path => findMappedPath(path, map);

  const direct = extension && tryDirect(resolved, findFile)
  if (direct) {
    return {
      absPath: direct,
      extension: extension,
      fileExists: true,
    }
  }

  // try files without extensions first
  let fileExtensions: Array<string> = TS_EXTENSIONS_FIRST;
  if (props.javascriptFirst) {
    fileExtensions = JS_EXTENSIONS_FIRST;
  }
  if (props.typescriptFirst) {
    fileExtensions = TS_EXTENSIONS_FIRST;
  }
  const targetFile = tryExtensions(resolved, fileExtensions, findPath);
  if (targetFile) {
    return {
      absPath: targetFile,
      extension: path.extname(targetFile),
      fileExists: true,
    };
  }

  let isDirectory: boolean;
  // try directory indexes
  const exists = fileExists(resolved);
  if (exists) {
    const stat = fs.lstatSync(resolved);
    if (stat.isDirectory) {
      isDirectory = true;

      let monorepoModulesPaths;
      let tsConfigAtPath: TsConfigAtPath;

      // only in case of a directory
      const packageJSONPath = path.join(resolved, 'package.json');
      if (fileExists(packageJSONPath)) {
        const useLocalMain = !/node_modules/.test(packageJSONPath);
        const packageJSON = require(packageJSONPath);
        const entry = getFolderEntryPointFromPackageJSON({ json: packageJSON, useLocalField: useLocalMain });

        if (useLocalMain && packageJSON['local:main']) {
          const _monoModules = path.resolve(resolved, 'node_modules');
          if (fileExists(_monoModules)) {
            monorepoModulesPaths = _monoModules;
          }

          const _tsConfig = path.resolve(resolved, 'tsconfig.json');
          if (fileExists(_tsConfig)) {
            const tsConfigParsed = parseTypescriptConfig(_tsConfig);
            if (!tsConfigParsed.error)
              tsConfigAtPath = {
                absPath: resolved,
                compilerOptions: tsConfigParsed.config.compilerOptions,
                tsconfigPath: _tsConfig,
              };
          }
        }

        const entryFile = path.join(resolved, entry);
        return {
          absPath: entryFile,
          customIndex: true,
          extension: path.extname(entryFile),
          fileExists: fileExists(entryFile),
          isDirectoryIndex: true,
          monorepoModulesPaths,
          tsConfigAtPath,
        };
      }

      let indexes: Array<string> = TS_INDEXES_FIRST;
      if (props.javascriptFirst) {
        indexes = JS_INDEXES_FIRST;
      }
      if (props.typescriptFirst) {
        indexes = TS_INDEXES_FIRST;
      }
      const directoryIndex = tryIndexes(resolved, indexes, findPath);
      if (directoryIndex) {
        return {
          absPath: directoryIndex,
          extension: path.extname(directoryIndex),
          fileExists: true,
          isDirectoryIndex: true,
        };
      }
    }
  }

  // as a last resort, we should try ".json" which is a very rare case
  // that's why it has the lowest priority here
  if (!isDirectory) {
    const targetFile = tryExtensions(resolved, ['.json'], findPath);
    if (targetFile) {
      return {
        absPath: targetFile,
        customIndex: true, // it still needs to be re-written because FuseBox client API won't find it
        extension: path.extname(targetFile),
        fileExists: true,
      };
    }
  }
  return {
    absPath: resolved,
    fileExists: false,
  };
}
