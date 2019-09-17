import { Context } from '../../core/Context';
import * as path from 'path';

export interface IPluginSplitEntryProps {
  entries: Array<string>;
}

export function pluginSplitEntry(opts: IPluginSplitEntryProps) {
  return (ctx: Context) => {
    const config = ctx.config;
    console.log(config.entries[0]);
    opts.entries.map(item => {
      if (path.isAbsolute(item)) {
        //path.relative(config.entries[0])
      }
    });

    config.homeDir;
  };
}
