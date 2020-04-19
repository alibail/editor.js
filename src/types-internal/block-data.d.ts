import {BlockToolData} from '../../types/tools';

/**
 * Tool's saved data
 */
export interface SavedData {
    tool: string;
    data: BlockToolData;
    time: number;
}

/**
 * Tool's data after validation
 */
export interface ValidatedData {
    tool?: string;
    data?: BlockToolData;
    time?: number;
    isValid: boolean;
}

/**
 * Interface for the MetaData part of the block
 *
 * Change this to match the type of data you wish to store along
 * with each block. Remember to update src/mixin.ts to your new format. 
 **/
 export interface MetaDataBlock {
   id?: string;
   data?: string;
 }
