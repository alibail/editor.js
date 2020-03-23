import {
  API,
  BlockTool,
  BlockToolConstructable,
  BlockToolData,
  BlockTune,
  BlockTuneConstructable,
  SanitizerConfig,
  ToolSettings,
} from '../../../types';

import {SavedData} from '../../types-internal/block-data';
import $ from '../dom';
import * as _ from '../utils';

/**
 * @class Block
 * @classdesc This class describes editor`s block, including block`s HTMLElement, data and tool
 *
 * @property {BlockTool} tool — current block tool (Paragraph, for example)
 * @property {Object} CSS — block`s css classes
 *
 */

/** Import default tunes */
import MoveUpTune from '../block-tunes/block-tune-move-up';
import DeleteTune from '../block-tunes/block-tune-delete';
import MoveDownTune from '../block-tunes/block-tune-move-down';
import SelectionUtils from '../selection';
import BlockAPI from './api';
import {BlockAPI as BlockAPIInterface, BlockTuneData} from '../../../types';

/**
 * Available Block Tool API methods
 */
export enum BlockToolAPI {
  /**
   * @todo remove method in 3.0.0
   * @deprecated — use 'rendered' hook instead
   */
  APPEND_CALLBACK = 'appendCallback',
  RENDERED = 'rendered',
  MOVED = 'moved',
  UPDATED = 'updated',
  REMOVED = 'removed',
  ON_PASTE = 'onPaste',
}

export interface BlockOptions {
  /**
   * @property {String} toolName - Tool name that passed on initialization
   */
  toolName: string;

  /**
   * @property {BlockToolConstructable} Tool — Tool class
   */
  Tool: BlockToolConstructable;

  /**
   * @property {ToolSettings} settings - Tool settings passed to initial config
   */
  settings: ToolSettings;

  /**
   * @property {BlockToolData} data — Block's data
   */
  data: BlockToolData;

  /**
   * @property {object} tunesData - tunes data related to Block
   */
  tunesData: {[name: string]: BlockTuneData};

  /**
   * @property {API} api — Editor's API methods
   */
  api: API;
}

/**
 * @classdesc Abstract Block class that contains Block information, Tool name and Tool class instance
 *
 * @property tool - Tool instance
 * @property html - Returns HTML content of plugin
 * @property holder - Div element that wraps block content with Tool's content. Has `ce-block` CSS class
 * @property pluginsContent - HTML content that returns by Tool's render function
 *
 * @todo Split class to several interfaces (as it is too big)
 */
export default class Block {

  /**
   * CSS classes for the Block
   * @return {{wrapper: string, content: string}}
   */
  static get CSS() {
    return {
      wrapper: 'ce-block',
      wrapperStretched: 'ce-block--stretched',
      content: 'ce-block__content',
      focused: 'ce-block--focused',
      selected: 'ce-block--selected',
      dropTarget: 'ce-block--drop-target',
    };
  }

  /**
   * Find and return all editable elements (contenteditables and native inputs) in the Tool HTML
   *
   * @returns {HTMLElement[]}
   */
  get inputs(): HTMLElement[] {
    /**
     * Return from cache if existed
     */
    if (this.cachedInputs.length !== 0) {
      return this.cachedInputs;
    }

    const content = this.holder;
    const allowedInputTypes = ['text', 'password', 'email', 'number', 'search', 'tel', 'url'];

    const selector = '[contenteditable], textarea, input:not([type]), '
      + allowedInputTypes.map((type) => `input[type="${type}"]`).join(', ');

    let inputs = _.array(content.querySelectorAll(selector));

    /**
     * If contenteditable element contains block elements, treat them as inputs.
     */
    inputs = inputs.reduce((result, input) => {
      if ($.isNativeInput(input) || $.containsOnlyInlineElements(input)) {
        return [...result, input];
      }

      return [...result, ...$.getDeepestBlockElements(input)];
    }, []);

    /**
     * If inputs amount was changed we need to check if input index is bigger then inputs array length
     */
    if (this.inputIndex > inputs.length - 1) {
      this.inputIndex = inputs.length - 1;
    }

    /**
     * Cache inputs
     */
    this.cachedInputs = inputs;

    return inputs;
  }

  /**
   * Return current Tool`s input
   *
   * @returns {HTMLElement}
   */
  get currentInput(): HTMLElement | Node {
    return this.inputs[this.inputIndex];
  }

  /**
   * Set input index to the passed element
   *
   * @param {HTMLElement} element
   */
  set currentInput(element: HTMLElement | Node) {
    const index = this.inputs.findIndex((input) => input === element || input.contains(element));

    if (index !== -1) {
      this.inputIndex = index;
    }
  }

  /**
   * Return first Tool`s input
   *
   * @returns {HTMLElement}
   */
  get firstInput(): HTMLElement {
    return this.inputs[0];
  }

  /**
   * Return first Tool`s input
   *
   * @returns {HTMLElement}
   */
  get lastInput(): HTMLElement {
    const inputs = this.inputs;

    return inputs[inputs.length - 1];
  }

  /**
   * Return next Tool`s input or undefined if it doesn't exist
   *
   * @returns {HTMLElement}
   */
  get nextInput(): HTMLElement {
    return this.inputs[this.inputIndex + 1];
  }

  /**
   * Return previous Tool`s input or undefined if it doesn't exist
   *
   * @returns {HTMLElement}
   */
  get previousInput(): HTMLElement {
    return this.inputs[this.inputIndex - 1];
  }

  /**
   * Get Block's JSON data
   * @return {Object}
   */
  get data(): Promise<BlockToolData> {
    return this.save().then((savedObject) => {
      if (savedObject && !_.isEmpty(savedObject.data)) {
        return savedObject.data;
      } else {
        return {};
      }
    });
  }

  /**
   * Returns tool's sanitizer config
   * @return {object}
   */
  get sanitize(): SanitizerConfig {
    return this.tool.sanitize;
  }

  /**
   * is block mergeable
   * We plugin have merge function then we call it mergable
   * @return {boolean}
   */
  get mergeable(): boolean {
    return typeof this.tool.merge === 'function';
  }

  /**
   * Check block for emptiness
   * @return {Boolean}
   */
  get isEmpty(): boolean {
    const emptyText = $.isEmpty(this.pluginsContent);
    const emptyMedia = !this.hasMedia;

    return emptyText && emptyMedia;
  }

  /**
   * Check if block has a media content such as images, iframes and other
   * @return {Boolean}
   */
  get hasMedia(): boolean {
    /**
     * This tags represents media-content
     * @type {string[]}
     */
    const mediaTags = [
      'img',
      'iframe',
      'video',
      'audio',
      'source',
      'input',
      'textarea',
      'twitterwidget',
    ];

    return !!this.holder.querySelector(mediaTags.join(','));
  }

  /**
   * Set focused state
   * @param {Boolean} state - 'true' to select, 'false' to remove selection
   */
  set focused(state: boolean) {
    this.holder.classList.toggle(Block.CSS.focused, state);
  }

  /**
   * Get Block's focused state
   */
  get focused() {
    return this.holder.classList.contains(Block.CSS.focused);
  }

  /**
   * Set selected state
   * We don't need to mark Block as Selected when it is empty
   * @param {Boolean} state - 'true' to select, 'false' to remove selection
   */
  set selected(state: boolean) {
    if (state) {
      this.holder.classList.add(Block.CSS.selected);
    } else {
      this.holder.classList.remove(Block.CSS.selected);
    }
  }

  /**
   * Returns True if it is Selected
   * @return {boolean}
   */
  get selected(): boolean {
    return this.holder.classList.contains(Block.CSS.selected);
  }

  /**
   * Set stretched state
   * @param {Boolean} state - 'true' to enable, 'false' to disable stretched statte
   */
  set stretched(state: boolean) {
    this.holder.classList.toggle(Block.CSS.wrapperStretched, state);
  }

  /**
   * Return Block's stretched state
   *
   * @return {boolean}
   */
  get stretched(): boolean {
    return this.holder.classList.contains(Block.CSS.wrapperStretched);
  }

  /**
   * Toggle drop target state
   * @param {boolean} state
   */
  public set dropTarget(state) {
    this.holder.classList.toggle(Block.CSS.dropTarget, state);
  }

  /**
   * Block Tool`s name
   */
  public name: string;

  /**
   * Instance of the Tool Block represents
   */
  public tool: BlockTool;

  /**
   * Class blueprint of the ool Block represents
   */
  public class: BlockToolConstructable;

  /**
   * User Tool configuration
   */
  public settings: ToolSettings;

  /**
   * Wrapper for Block`s content
   */
  public holder: HTMLDivElement;

  /**
   * Returns Plugins content
   * @return {HTMLElement}
   */
  public pluginsContent: HTMLElement = null;

  /**
   * Tunes used by Tool
   */
  public tunes: BlockTune[];

  /**
   * Cached inputs
   * @type {HTMLElement[]}
   */
  private cachedInputs: HTMLElement[] = [];

  /**
   * Editor`s API
   */
  private readonly api: API;

  /**
   * Current Block`s API
   */
  private readonly blockAPI: BlockAPIInterface;

  /**
   * Focused input index
   * @type {number}
   */
  private inputIndex = 0;

  /**
   * Mutation observer to handle DOM mutations
   * @type {MutationObserver}
   */
  private mutationObserver: MutationObserver;

  /**
   * Debounce Timer
   * @type {number}
   */
  private readonly modificationDebounceTimer = 450;

  /**
   * Is fired when DOM mutation has been happened
   */
  private didMutated = _.debounce((): void => {
    /**
     * Drop cache
     */
    this.cachedInputs = [];

    /**
     * Update current input
     */
    this.updateCurrentInput();

    this.call(BlockToolAPI.UPDATED);
  }, this.modificationDebounceTimer);

  /**
   * @constructor
   * @param {String} toolName - Tool name that passed on initialization
   * @param {BlockToolConstructable} Tool — Tool class
   * @param {API} api — Editor's API methods
   * @param {ToolSettings} settings - Tool settings passed to initial config
   * @param {object} tunesData - tunes data related to Block
   * @param {BlockToolData} data — Block's data
   */
  constructor({
    toolName,
    Tool,
    settings,
    api,
    tunesData,
    data,
  }: BlockOptions) {
    this.name = toolName;
    this.class = Tool;
    this.settings = settings;
    this.api = api;
    this.blockAPI = new BlockAPI(this);

    this.tool = new Tool({
      api,
      block: this.blockAPI,
      config: settings.config || {},
      data,
    });

    /**
     * @type {BlockTune[]}
     */
    this.tunes = this.makeTunes(tunesData);
    this.holder = this.compose();

    this.mutationObserver = new MutationObserver(this.didMutated);

  }

  /**
   * Calls Tool's method
   *
   * Method checks tool property {MethodName}. Fires method with passes params If it is instance of Function
   *
   * @param {String} methodName
   * @param {Object} params
   */
  public call(methodName: string, params?: object) {
    /**
     * call Tool's method with the instance context
     */
    if (this.tool[methodName] && this.tool[methodName] instanceof Function) {
      try {
        this.tool[methodName].call(this.tool, params);
      } catch (e) {
        _.log(`Error during '${methodName}' call: ${e.message}`, 'error');
      }
    }
  }

  /**
   * Call plugins merge method
   * @param {Object} data
   */
  public async mergeWith(data: BlockToolData): Promise<void> {
    await this.tool.merge(data);
  }
  /**
   * Extracts data from Block
   * Groups Tool's save processing time
   * @return {Object}
   */
  public async save(): Promise<void|SavedData> {
    const extractedBlock = await this.tool.save(this.pluginsContent as HTMLElement);

    const tunesData = this.tunes.reduce((res, tune) => {
      if (typeof tune.save === 'function') {
        res[_.camelCaseToKebab(tune.constructor.name)] = tune.save();
      }

      return res;
    }, {} as any);

    /**
     * Measuring execution time
     */
    const measuringStart = window.performance.now();
    let measuringEnd;

    return Promise.resolve(extractedBlock)
      .then((finishedExtraction) => {
        /** measure promise execution */
        measuringEnd = window.performance.now();

        return {
          tool: this.name,
          data: finishedExtraction,
          time: measuringEnd - measuringStart,
          tunes: tunesData,
        };
      })
      .catch((error) => {
        _.log(`Saving proccess for ${this.name} tool failed due to the ${error}`, 'log', 'red');
      });
  }

  /**
   * Uses Tool's validation method to check the correctness of output data
   * Tool's validation method is optional
   *
   * @description Method returns true|false whether data passed the validation or not
   *
   * @param {BlockToolData} data
   * @returns {Promise<boolean>} valid
   */
  public async validate(data: BlockToolData): Promise<boolean> {
    let isValid = true;

    if (this.tool.validate instanceof Function) {
      isValid = await this.tool.validate(data);
    }

    return isValid;
  }

  /**
   * Make an array with default settings
   * Each block has default tune instance that have states
   * @return {BlockTune[]}
   */
  public makeTunes(tunesData: {[name: string]: BlockTuneData}): BlockTune[] {

    /**
     * @todo Render Block related tunes and common tunes to separate rows
     */
    const tunesList = (this.settings.tunes || []).concat([MoveUpTune, DeleteTune, MoveDownTune]);

    // Pluck tunes list and return tune instances with passed Editor API and settings
    return tunesList.map( (tune: BlockTuneConstructable) => {
      const tuneName = tune.name;

      return new tune({
        api: this.api,
        settings: this.settings,
        data: tunesData[_.camelCaseToKebab(tuneName)],
        block: new BlockAPI(this),
      });
    });
  }

  /**
   * Enumerates initialized tunes and returns fragment that can be appended to the toolbars area
   * @return {DocumentFragment}
   */
  public renderTunes(): DocumentFragment {
    const tunesElement = document.createDocumentFragment();

    this.tunes.forEach( (tune) => {
      $.append(tunesElement, tune.render());
    });

    return tunesElement;
  }

  /**
   * Update current input index with selection anchor node
   */
  public updateCurrentInput(): void {
    this.currentInput = SelectionUtils.anchorNode;
  }

  /**
   * Is fired when Block will be selected as current
   */
  public willSelect(): void {
    /**
     * Observe DOM mutations to update Block inputs
     */
    this.mutationObserver.observe(
      this.holder.firstElementChild,
      {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      },
    );
  }

  /**
   * Is fired when Block will be unselected
   */
  public willUnselect() {
    this.mutationObserver.disconnect();
  }

  /**
   * Make default Block wrappers and put Tool`s content there
   * @returns {HTMLDivElement}
   */
  private compose(): HTMLDivElement {
    const wrapper = $.make('div', Block.CSS.wrapper) as HTMLDivElement,
      contentNode = $.make('div', Block.CSS.content),
      pluginsContent = this.tool.render();

    this.pluginsContent = pluginsContent;

    const wrapped = this.tunes.reduce((res, tune) => {
      if (typeof tune.wrap === 'function') {
        return tune.wrap(res);
      }

      return res;
    }, pluginsContent);

    contentNode.appendChild(wrapped);
    wrapper.appendChild(contentNode);
    return wrapper;
  }
}