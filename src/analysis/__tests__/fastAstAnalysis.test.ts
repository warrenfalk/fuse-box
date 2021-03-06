import { fastAstAnalysis } from '../fastAstAnalysis';
import { ImportType } from '../../resolver/resolver';

describe('Fast ast analysis', () => {
  describe('Web workers', () => {
    it('should give a worker', () => {
      const res = fastAstAnalysis({
        input: `
        new Worker('./worker/worker.ts')
      `,
      });
      expect(res.workers).toEqual([{ path: './worker/worker.ts', type: 'Worker' }]);
    });

    it('should give 2 workers', () => {
      const res = fastAstAnalysis({
        input: `
        new Worker('./worker/worker.ts')
        new Worker('./worker/worker2.ts')
      `,
      });

      expect(res.workers).toEqual([
        { path: './worker/worker.ts', type: 'Worker' },
        { path: './worker/worker2.ts', type: 'Worker' },
      ]);
    });

    it('should give a SharedWorker', () => {
      const res = fastAstAnalysis({
        input: `
        new SharedWorker('./worker/worker.ts')
      `,
      });

      expect(res.workers).toEqual([{ path: './worker/worker.ts', type: 'SharedWorker' }]);
    });
  });
  describe('Imports', () => {
    it('should give raw import', () => {
      const res = fastAstAnalysis({
        input: `
        import "foo"
      `,
      });
      expect(res.imports[0].statement).toEqual('foo');
      expect(res.report.es6Syntax).toEqual(true);
    });

    it('should not give raw import', () => {
      const res = fastAstAnalysis({
        input: `
        import "foo"
      `,
      });
      expect(res.imports[0].statement).toEqual('foo');
      expect(res.report.es6Syntax).toEqual(true);
    });

    it('should give import from', () => {
      const res = fastAstAnalysis({
        input: `
        import * as bar from "./foo"
      `,
      });
      expect(res.imports[0].statement).toEqual('./foo');
      expect(res.report.es6Syntax).toEqual(true);
    });

    it('should give export from', () => {
      const res = fastAstAnalysis({
        input: `
        export { name  } from "./foo"
      `,
      });
      expect(res.imports[0].statement).toEqual('./foo');
      expect(res.report.es6Syntax).toEqual(true);
    });

    it('should give dynamic import', () => {
      const res = fastAstAnalysis({
        input: `
        async function bar(){
          await import("./oi")
        }
      `,
      });
      expect(res.imports).toEqual([{ type: ImportType.DYNAMIC, statement: './oi' }]);
      expect(res.report.es6Syntax).toEqual(true);
      expect(res.report.dynamicImports).toEqual(true);
    });

    it('should not give dynamic import', () => {
      expect(() => {
        fastAstAnalysis({
          input: `
          async function bar(){
            await import(foo)
          }
        `,
        });
      }).toThrowError();
    });

    // it('should give export * from', () => {
    //   const res = fastAstAnalysis({
    //     input: `
    //     export * as foo from "./foo";
    //   `,
    //   });
    //   expect(res.imports[0].statement).toEqual('./foo');
    //   expect(res.report.es6Syntax).toEqual(true);
    // });

    it('should give export function and es6 syntax', () => {
      const res = fastAstAnalysis({
        input: `
        export function __extends(d, b) {

        }
      `,
      });

      expect(res.report.es6Syntax).toEqual(true);
    });

    it('should give es6 true', () => {
      const res = fastAstAnalysis({
        input: `
        export default a;
      `,
      });
      expect(res.report.es6Syntax).toEqual(true);
    });

    it('should give jsx true', () => {
      const res = fastAstAnalysis({
        input: `
        export function App() {
          return <div>Hello world</div>;
        }
      `,
      });
      expect(res.report.containsJSX).toEqual(true);
    });

    it('should give require statement', () => {
      const res = fastAstAnalysis({
        input: `
        require('./foo')
      `,
      });
      expect(res.imports).toEqual([{ type: ImportType.REQUIRE, statement: './foo' }]);
    });

    it('should not give require statement', () => {
      const res = fastAstAnalysis({
        input: `
        require(foo)
      `,
      });
      expect(res.imports).toEqual([]);
    });
  });

  describe('trace variables', () => {
    it('should give __filename', () => {
      const res = fastAstAnalysis({
        input: `
        console.log(__filename)
      `,
      });

      expect(res.report.contains__filename).toEqual(true);
    });

    it('should give __dirname', () => {
      const res = fastAstAnalysis({
        input: `
        console.log(__dirname)
      `,
      });

      expect(res.report.contains__dirname).toEqual(true);
    });

    it('should not give __dirname', () => {
      const res = fastAstAnalysis({
        input: `
        const __dirname = ""
        console.log(__dirname)
      `,
      });

      expect(res.report.contains__filename).toBeUndefined();
    });

    it('should give buffer', () => {
      const res = fastAstAnalysis({
        input: `
        console.log(buffer)
      `,
      });

      expect(res.report.browserEssentials).toEqual([{ moduleName: 'buffer', obj: 'Buffer', variable: 'buffer' }]);
    });

    it('should give Buffer', () => {
      const res = fastAstAnalysis({
        input: `
        console.log(Buffer)
      `,
      });

      expect(res.report.browserEssentials).toEqual([{ moduleName: 'buffer', obj: 'Buffer', variable: 'Buffer' }]);
    });

    it('should not give Buffer', () => {
      const res = fastAstAnalysis({
        input: `
        const Buffer = {}
        console.log(Buffer)
      `,
      });

      expect(res.report.browserEssentials).toBeUndefined();
    });

    it('should give http', () => {
      const res = fastAstAnalysis({
        input: `
        console.log(http)
      `,
      });

      expect(res.report.browserEssentials).toEqual([{ moduleName: 'http', variable: 'http' }]);
    });

    it('should detect process', () => {
      const res = fastAstAnalysis({
        input: `
        if (process.browser) {

        }
      `,
      });

      expect(res.report.browserEssentials).toEqual([{ moduleName: 'process', variable: 'process' }]);
    });

    it('should not detect process', () => {
      const res = fastAstAnalysis({
        input: `
        if (foo.process.browser) {

        }
      `,
      });

      expect(res.report.browserEssentials).toBeUndefined();
    });

    it('should not detect process (hoisted function) 1', () => {
      const res = fastAstAnalysis({
        input: `
        function process(){}
        console.log(process)
      `,
      });

      expect(res.report.browserEssentials).toBeUndefined();
    });

    it('should not detect process (hoisted function) 1', () => {
      const res = fastAstAnalysis({
        input: `
        console.log(process)
        function process(){}
      `,
      });
      expect(res.report.browserEssentials).toEqual([]);
    });
  });
});
