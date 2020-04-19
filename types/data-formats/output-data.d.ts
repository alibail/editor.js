import {BlockToolData} from '../tools';
import {MetaDataBlock} from '../../src/types-internal/block-data.d.ts';

export interface OutputData {
  /**
   * Editor's version
   */
  version?: string;

  /**
   * Timestamp of saving in milliseconds
   */
  time?: number;

  /**
   * Saved Blocks
   */
  blocks: Array<{
    type: string;
    metadata?: MetaDataBlock;
    data: BlockToolData
  }>;
}
