# Typescript Project References

Summary:
```typescript
// the following can sort of be made to work in fuse-box
// using "ts:main" in my-ts-lib/package.json
import {thingy} from "my-ts-lib";

// but the following does not work at all in fuse-box
import {deeply} from "my-ts-lib/dist/deepfile";

// However, both of the above are legitimate typescript and
// work correctly with both "tsc --build" and in vscode.
```

This can lead to a lot of frustrating trying to get **fuse-box** + **monorepo** + **TypesSript** setup very frustrating to work with.

Although fuse-box will read a `"ts:main"` or a `"local:main"` from a `package.json` to allow you to work around this, it only works for entry points, and has issues with transitive dependencies.

This is despite being perfectly legitimate TypeScript since version 3, supported by both `tsc --build` and Visual Studio Code via what are called "Project References".  See [https://www.typescriptlang.org/docs/handbook/project-references.html](https://www.typescriptlang.org/docs/handbook/project-references.html).

I am proposing that fuse-box should try to achieve parity with `tsc --build` and Visual Studio Code if at all possible.  If a package with the above imports can be built with `tsc --build` and Visual Studio Code is capable of watching and automatically resolving `dist/deepfile` to `src/deepfile.ts`, then `.runDev()` should be able to do these things, too.

The way the project references work is that `tsconfig.json` files declare `"references"` to other `tsconfig.json` files by their path (usually relative).  These do not replace the `"dependencies"` entry already in `package.json`, they augment them.  The `package.json` `"dependencies"` continue to to specify a "package" relationship using whatever protocol the package manager understands (e.g. to `"^1.1.0"` or `"git://github.com/user/project.git#commit-ish"`).  The `tsconfig.json` `"references"` on the other hand specify where to look for a source project (another `tsconfig.json` usually relative to the referencing `tsconfig.json`).  If found at that relative location, TypeScript is able to build and watch that dependent project also (and recursively into its dependencies), and IDEs such as Visual Studio Code will automatically translate `import` statement paths like those above to their *source* equivalent.  For example, in vscode, I can import from `"my-ts-lib/dist/deepfile"` which at runtime is found at `"my-ts-lib/dist/deepfile.js"` and vscode will know that this corresponds to `"my-ts-lib/src/deepfile.ts"`.

Note: this is not the same thing as `ts

I have implemented this within fuse-box.  Note that this should have no effect if you don't declare 

___
> Written with [StackEdit](https://stackedit.io/).
<!--stackedit_data:
eyJoaXN0b3J5IjpbMTY2OTMwOTg0NSw1Njg5MDkwMzksLTE4Nj
k0OTUxNjFdfQ==
-->