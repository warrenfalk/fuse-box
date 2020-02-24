# Typescript Project References

Summary:
```typescript
// the following can sorta work in fuse-box as long as I set "ts:main" in my-ts-lib/package.json
import {thingy} from "my-ts-lib";

// does not work in fuse-box at all
import {deeply} from "my-ts-lib/dist/deepfile";

// but both of the above are legitimate typescript and
// work correctly with both "tsc --build" and in vscode.
```

If I have a typescript project, `my-ts-lib`, that I want to include from my fuse-box app, `my-fusebox-app`.  From `my-fusebox-app` I can `import {thingy} from "my-ts-lib"` but it will resolve to `"dist/index.js"` because `my-ts-lib/package.json` specifies that in its `"main"` field.

It looks like fuse-box will read a `"ts:main"` or a `"local:main"` from a `package.json` to allow you to work around this.  However, this only works for entry points.  For example, `import {deeply} from "my-ts-lib/dist/deepfile"` is not solved by this solution and will not work.

This is despite being perfectly legitimate TypeScript.  I.e. TypeScript has been capable of this using `tsc --build` since version 3 using `"references"` in `tsconfig.json`.  This is called "Project References"

See [https://www.typescriptlang.org/docs/handbook/project-references.html](https://www.typescriptlang.org/docs/handbook/project-references.html) for more information on what TypeScript Project References are.

I propose that if `tsc --build` can compile a package, then we should try to make fuse-box capable of compiling that same package.  Furthermore since editors like Visual Studio Code also understand project references, implementing them would allow fuse-box to mirror the editor's behavior (e.g. if Visual Studio Code understands which source file is behind `my-ts-lib/dist/deepfile` then it would be great if fuse-box did, too, so I don't get surprised when it's time to build).

The way the project references work is that `tsconfig.json` files declare `"references"` to other `tsconfig.json` files by their path (usually relative).  These do not replace the `"dependencies"` entry already in `package.json`, they augment them.  The `package.json` `"dependencies"` continue to to specify a "package" relationship using whatever protocol the package manager understands (e.g. to `"^1.1.0"` or `"git://github.com/user/project.git#commit-ish"`).  The `tsconfig.json` `"references"` on the other hand specify where to look for a source project (another `tsconfig.json` usually relative to the referencing `tsconfig.json`).  If found at that relative location, TypeScript is able to build and watch that dependent project also (and recursively into its dependencies), and IDEs such as Visual Studio Code will automatically translate `import` statement paths like those above to their *source* equivalent.  For example, in vscode, I can import from `"my-ts-lib/dist/deepfile"` which at runtime is found at `"my-ts-lib/dist/deepfile.js"` and vscode will know that this corresponds to `"my-ts-lib/src/deepfile.ts"`.



___
> Written with [StackEdit](https://stackedit.io/).
<!--stackedit_data:
eyJoaXN0b3J5IjpbNzk2NDI1NTEyLC0xODY5NDk1MTYxXX0=
-->