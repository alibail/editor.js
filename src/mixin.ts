/***
 * Allows you to setup the editor to create the required
 * metadata element.
 *
 * Should return the block in the format specified in MetaDataBlock which
 * can be set in src/types-internal/block-data
 *
 * This configuration has an id element and data element - both are strings
 ***/
 import {MetaDataBlock} from './types-internal/block-data';

 let counter = 0;

 export default {
   createMeta() {
     let id = 'block-' + counter;
     console.log ( 'Creating Meta: ' + id );
     const data = '';

     const existId = () => {
       if ( document.getElementById(id)) {
         return true; } else { return false; }
     };

     do {
       counter++;
       id = 'block-' + counter;
     } while (existId());
     return {id, data: ''};
   },
 };
