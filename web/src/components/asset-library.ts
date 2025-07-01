import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { join } from "lit/directives/join.js";
import { map } from "lit/directives/map.js";
import { html as shtml, unsafeStatic } from "lit/static-html.js";
import { getRelativeOffset } from "../browser-utils/positioning";
import {
  type IDBLocation,
  deleteFromStorage,
  deserialize,
  initIDBStores,
  serialize,
} from "../browser-utils/serialization";
import { randomUUID } from "../utils/crypto";
import { fetchMimeType } from "../utils/sniffer";
import { WindowHeader } from "./window-header";

export type SortBy = "name" | "time" | "type";

export type UrlSource = {
  sourceType: "url";
  url: string;
};

export type IdbSource = {
  sourceType: "idb";
  databaseName: string;
  storeName: string;
  key: string;
  valuePath: string;
  dataUrl?: string;
};

export type OpfsSource = {
  sourceType: "opfs";
  filePath: string[];
  dataUrl?: string;
};

export type DataSource = UrlSource | IdbSource | OpfsSource;

export type VideoAsset = {
  type: "video";
  mimeType?: string;
};

export type ImageAsset = {
  type: "image";
  mimeType?: string;
};

export type AudioAsset = {
  type: "audio";
  mimeType?: string;
};

export type TextAsset = {
  type: "text";
  mimeType?: string;
};

export type UnknownMediaAsset = {
  type: "";
  mimeType?: string;
};

export type MediaAsset =
  | TextAsset
  | ImageAsset
  | AudioAsset
  | VideoAsset
  | UnknownMediaAsset;

export type Asset = MediaAsset;

export type AssetSource = Asset & DataSource;

export type LibraryEntry = {
  name: string;
  tags: string[];
  lastModifiedTimeMs: number;
  selected?: boolean;
} & (
  | {
      isFolder: false;
      asset: AssetSource;
    }
  | {
      isFolder: true;
      entries: Record<string, LibraryEntry>;
    }
);

export type LibraryFolder = LibraryEntry & { isFolder: true };
export type LibraryAsset = LibraryEntry & { isFolder: false };

export class AssetLibraryEvent extends Event {
  readonly selectedAssets: LibraryAsset[];

  constructor(type: "ok" | "cancel", selectedAssets: LibraryAsset[] = []) {
    super(type, { bubbles: false, cancelable: false });
    this.selectedAssets = selectedAssets;
  }
}

// Limit writing to IDB to at most once per second.
const IDB_WRITE_PERIOD_MS = 1000;

export class AssetLibrary extends LitElement {
  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link AssetLibrary} as a custom web component with tag
   * `tagName`.
   *
   * The return value of this function is the tag name that was registered with
   * this component.
   *
   * Since a component can be registered only once, only the first call will
   * actually register the component. Subsequent calls will simply return the
   * tag name that was first registered.
   *
   * Other components that depend on this module can call this function to
   * retrieve the correct tag name instead of assuming that the tag name they
   * supply to `register` is the correct one.
   *
   * @param tagName Desired tag name.
   * @returns The tag name that was registered for this element.
   *   This may be different from the input `tagName` if `register` had been
   *   called earlier, in which case, this return value should be used.
   */
  static register(tagName: string = "asset-library"): string {
    if (!AssetLibrary.tagName) {
      customElements.define(tagName, AssetLibrary);
      AssetLibrary.tagName = tagName;
    }
    return AssetLibrary.tagName;
  }

  @property()
  title: string = "Library";

  @state()
  protected rootFolder: LibraryFolder = {
    name: "root",
    tags: [],
    lastModifiedTimeMs: -1,
    isFolder: true,
    entries: {},
  };

  @property({ type: Boolean })
  allowsCreation: boolean = true;

  @property({ type: Boolean })
  allowsDeletion: boolean = true;

  @property({ type: Boolean })
  allowsRenaming: boolean = true;

  @property({ type: Array })
  rootFolderPath: string[] = ["root"];

  @property({ type: Array })
  currentFolderPath: string[] = ["root"];

  @property({ type: String })
  selectMode: "none" | "single" | "multiple" = "single";

  @property()
  okButtonText: string = "";

  @property()
  cancelButtonText: string = "";

  @property()
  filter: string = "";

  @property({ type: Array })
  sortOrders: { key: "name" | "time" | "type"; ascending: boolean }[] = [
    {
      key: "type",
      ascending: true,
    },
    {
      key: "name",
      ascending: true,
    },
    {
      key: "time",
      ascending: false,
    },
  ];

  @property({ type: Number })
  numColumns: number = 1;

  @property({ type: String })
  idbDatabaseName: string = "assetLibrary";

  @property({ type: String })
  idbObjectStoreName: string = "assetLibrary";

  @property({ type: String })
  idbKeyPath: string = "path";

  @property({ type: String })
  idbValuePath: string = "value";

  @state()
  private selection: Set<LibraryEntry> = new Set();

  @state()
  private focusedEntry?: LibraryEntry;

  get filterInput() {
    return this.shadowRoot?.getElementById("filter-input");
  }

  get newFolderInput() {
    return this.shadowRoot?.getElementById("new-folder-name");
  }

  setFocus(which: "filter" | "new-folder" = "filter") {
    if (which === "filter") {
      this.filterInput?.focus();
    } else if (which === "new-folder") {
      this.newFolderInput?.focus();
    }
  }

  focus() {
    this.setFocus();
  }

  static get styles() {
    return css`
      :host {
        border: 0;
        padding: 0;
        box-sizing: border-box;
        --srem: 1rem;
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      button {
        user-select: none;
        -webkit-user-select: none;
      }

      #container {
        position: relative;
        width: 100%;
        height: 100%;
        border: 0;
        padding: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background-color: var(--dialog-background-color, white);
      }

      #header {
        width: 100%;
        border: 0;
        margin: 0;
        padding: 0;
        font-family: sans-serif;
        font-size: 1.2em;
        line-height: 1.5;
        text-align: center;
        background-color: var(--dialog-title-background-color, blue);
        color: var(--dialog-title-color, white);
      }

      /* folder-tools section */

      #folder-tools {
        display: flex;
        flex-direction: row;
        padding: calc(0.1 * var(--srem)) var(--srem);
      }

      #up-button {
        margin: var(--srem);
      }

      #breadcrumbs {
        display: flex;
        flex-direction: row;
        align-items: center;
        max-width: 50%;
      }

      .breadcrumbs-folder {
        background-color: var(
          --asset-library-breadcrumbs-background-color,
          #beffa0
        );
        color: var(--asset-library-breadcrumbs-color, #214510);
        border-color: transparent;
        border-radius: calc(0.3 * var(--srem));
        cursor: pointer;
      }

      .breadcrumbs-folder[data-current="1"] {
        cursor: auto;
        color: var(--asset-library-breadcrumbs-background-color, #beffa0);
        background-color: var(--asset-library-breadcrumbs-color, #214510);
      }

      #breadcrumbs-folders {
        display: inline-block;
        overflow: auto;
      }

      #new-folder {
        flex-grow: 1;
        display: flex;
        flex-direction: row;
        align-items: center;
      }

      #new-folder input[type="text"] {
        flex-grow: 1;
        margin-left: calc(2 * var(--srem));
        margin-right: calc(0.5 * var(--srem));
      }

      #create-new-folder {
        min-width: max-content;
      }

      /* entry-table section */

      #entry-table-container {
        position: relative;
        flex: 1;
        align-self: center;
        width: calc(100% - 2 * var(--srem));
        border: 0.05em solid var(--entry-table-border-color, #0000ff);
        background-color: var(--entry-table-background-color, #fdfdfd);
        border-collapse: separate;
        border-spacing: 0;
        overflow: auto;
      }

      #entry-table {
        border-collapse: separate;
        border-spacing: 0;
        table-layout: auto;
        width: 100%;
      }

      #entry-table * {
        user-select: none;
        -webkit-user-select: none;
        vertical-align: middle;
      }

      #entry-table thead {
        position: sticky;
        top: 0;
        z-index: 1;
      }

      #entry-table th {
        padding: calc(0.5 * var(--srem)) var(--srem);
        text-align: center;
        font-weight: normal;
      }

      #entry-table th:nth-of-type(2n) {
        background-color: #f8f8ff;
      }

      #entry-table th:nth-of-type(2n + 1) {
        background-color: #f0f0ff;
      }

      #entry-table tbody tr {
        z-index: 0;
        scroll-margin-top: 100px;
      }

      #entry-table td {
        padding-top: calc(0.25 * var(--srem));
        padding-bottom: calc(0.25 * var(--srem));
      }

      .entry-table-header {
        width: max-content;
        padding: 0 calc(0.5 * var(--srem));
        text-align: center;
        white-space: nowrap;
      }

      .entry-table-header-preview {
        min-width: 40%;
      }

      .entry-table-header-name {
        max-width: calc(16 * var(--srem));
      }

      .entry-table-header-time {
        width: max-content;
        text-align: center;
        white-space: nowrap;
      }

      .entry-table-header-type {
        width: max-content;
        text-align: center;
        white-space: nowrap;
      }

      .entry-preview {
        min-width: 40%;
        position: relative;
        text-align: center;
      }

      .entry-preview img {
        max-width: 100%;
        max-height: calc(12 * var(--srem));
      }

      .entry-name {
        max-width: calc(16 * var(--srem));
        position: relative;
        padding: 0 calc(0.5 * var(--srem));
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .entry-time {
        width: max-content;
        padding: 0 calc(0.5 * var(--srem));
        text-align: center;
        white-space: nowrap;
      }

      .entry-type {
        width: max-content;
        padding: 0 calc(0.5 * var(--srem));
        text-align: center;
        white-space: nowrap;
      }

      .entry-row td {
        border-top: calc(0.05 * var(--srem)) solid transparent;
        border-bottom: calc(0.05 * var(--srem)) solid transparent;
      }

      .entry-row-selected td {
        color: var(--selection-color, #ffffff);
        background-color: var(--selection-background-color, #6060ff);
      }

      .entry-row-focused td {
        border-top: calc(0.05 * var(--srem)) dashed
          var(--focused-selection-color, #ffffff);
        border-bottom: calc(0.05 * var(--srem)) dashed
          var(--focused-selection-color, #ffffff);
        color: var(--focused-selection-color, #ffffff);
        background-color: var(--focused-selection-background-color, #0000ff);
      }

      .entry-row-focused:not(.entry-row-selected) td {
        border-top: calc(0.05 * var(--srem)) dashed
          var(--focused-color, #000000);
        border-bottom: calc(0.05 * var(--srem)) dashed 
          var(--focused-color, #000000);
        color: var(--focused-color, #000000);
        background-color: var(--focused-background-color, #f0f0ff);
      }

      .full-width-item {
        grid-column: 1 / -1;
      }

      /* select-options section */

      #select-options {
        padding: 0 var(--srem);
        display: flex;
        flex-direction: row;
        column-gap: var(--srem);
        justify-content: end;
      }

      /* asset-tools section */

      #asset-tools {
        padding: var(--srem);
        display: flex;
        flex-direction: row;
        justify-content: center;
        column-gap: calc(0.5 * var(--srem));
        padding-left: var(--srem);
        padding-right: var(--srem)
      }

      #asset-tools > * {
        flex-grow: 1;
        align-self: stretch;
      }

      #filter {
        flex-grow: 4;
        display: flex;
        flex-direction: row;
      }

      #filter input {
        flex-grow: 1;
      }

      /* Select Options */

      #ok-button {
        min-width: 6em;
      }

      #cancel-button {
        min-width: 6em;
      }

      /* Animated spinner */

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .spinner {
        transform-origin: center;
        animation: spin 1s linear infinite;
      }

      /* "Import from URL" dialog */

      #import-from-url-dialog {
        width: calc(max(min(30 * var(--srem), 90vw), 40vw));
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border: 0;
      }

      #import-from-url-dialog-content {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--srem);
        padding: var(--srem);
        align-content: center;
        align-items: center;
      }

      #import-from-url-input-section {
        width: 100%;
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: calc(0.6 * var(--srem));
        justify-items: end;
        align-content: center;
      }

      #import-from-url-input-section:nth-child(even) {
        justify-self: stretch;
        
      }

      #import-from-url-input-section input {
        width: 100%;
      }

      #import-from-url-button-section {
        justify-content: end;
      }

      #import-from-url-ok-button {
        min-width: 6em;
      }

      #import-from-url-cancel-button {
        min-width: 6em;
      }

      /* "Rename" dialog */

      #rename-dialog {
        width: calc(max(min(30 * var(--srem), 90vw), 40vw));
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border: 0;
      }

      #rename-dialog-content {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--srem);
        padding: var(--srem);
        align-content: center;
        align-items: center;
      }

      #rename-input-section {
        width: 100%;
        display: flex;
        flex-direction: row;
        grid-template-columns: max-content 1fr;
        gap: calc(0.6 * var(--srem));
        justify-content: center;
        align-content: stretch;
      }

      #rename-input-section > label {
        justify-self: end;
      }

      #rename-input-section > input {
        justify-self: stretch;
        flex: 1;
      }

      #rename-button-section {
        justify-content: end;
      }

      #rename-ok-button {
        min-width: 6em;
      }

      #rename-cancel-button {
        min-width: 6em;
      }
    `;
  }

  private _breadcrumbsButtonPrefix = "bcPrefix";

  private getEntryFromPath(entryPath: string[]) {
    // We assume that the first element of entryPath refers to root even though
    // it can have any name.
    // The name of the first element is only used for display.
    let entry: LibraryEntry = this.rootFolder;
    for (const folderName of entryPath.slice(1)) {
      if (entry.isFolder) {
        entry = entry.entries[folderName];
      } else {
        throw new Error("invalid asset library path");
      }
    }
    return entry;
  }

  private getEntryList(folder: LibraryFolder, filter: string = "") {
    const entries = Object.values(folder.entries).filter((entry) => {
      return entry.name.includes(filter);
    });
    const compareNames = (a: LibraryEntry, b: LibraryEntry) => {
      return a.name.localeCompare(b.name);
    };
    const compareTimes = (a: LibraryEntry, b: LibraryEntry) => {
      return a.lastModifiedTimeMs - b.lastModifiedTimeMs;
    };
    const compareTypes = (a: LibraryEntry, b: LibraryEntry) => {
      const aType = a.isFolder ? "" : a.asset.type;
      const bType = b.isFolder ? "" : b.asset.type;
      const typeComparison = aType.localeCompare(bType);
      if (typeComparison !== 0) {
        return typeComparison;
      }
      if (a.isFolder || b.isFolder) {
        return 0;
      }
      if (["image", "audio", "video", "text"].includes(aType)) {
        return (a.asset.mimeType ?? "").localeCompare(b.asset.mimeType ?? "");
      }
      return 0;
    };
    const compare = {
      name: compareNames,
      time: compareTimes,
      type: compareTypes,
    };
    const comparers: ((a: LibraryEntry, b: LibraryEntry) => number)[] = [];
    for (const { key, ascending } of this.sortOrders) {
      comparers.push(ascending ? compare[key] : reverseCompare(compare[key]));
    }
    const compareEntries = composeComparers(comparers);
    return entries.sort(compareEntries);
  }

  private htmlSortOrder(sortBy: SortBy) {
    const index = this.sortOrders.findIndex(({ key }) => key === sortBy);
    if (index < 0) {
      return nothing;
    }
    return html`
      (${index + 1}${
        this.sortOrders[index].ascending ? html`&#x25B2;` : html`&#x25BC`
      })
    `;
  }

  private toggleSortOrder = (sortBy: SortBy) => {
    const index = this.sortOrders.findIndex(({ key }) => key === sortBy);
    const ascending = index >= 0 ? !this.sortOrders[index].ascending : true;
    if (index >= 0) {
      this.sortOrders.splice(index, 1);
    }
    this.sortOrders.unshift({
      key: sortBy,
      ascending,
    });
    this.requestUpdate();
  };

  updated() {
    if (this.shadowRoot) {
    }
  }

  clearCache(currentFolder: LibraryFolder) {
    for (const entry of Object.values(currentFolder.entries)) {
      if ("asset" in entry && "dataUrl" in entry.asset) {
        delete entry.asset.dataUrl;
      }
    }
  }

  private goToParentFolder(currentFolder?: LibraryFolder) {
    if (this.currentFolderPath.length <= 1) {
      return;
    }
    this.clearSelection();
    if (currentFolder) {
      this.clearCache(currentFolder);
    }
    this.currentFolderPath = this.currentFolderPath.slice(0, -1);
  }

  private htmlFolderTools(currentFolder: LibraryFolder) {
    const breadcrumbFolderOnClick = (event: MouseEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.id.startsWith(this._breadcrumbsButtonPrefix)
      ) {
        const index = Number.parseInt(event.target.dataset.index ?? "-1");
        if (index >= 0 && index + 1 < this.currentFolderPath.length) {
          this.clearSelection();
          this.currentFolderPath = this.currentFolderPath.slice(0, index + 1);
        }
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const breadcrumbsFolders = map(
      this.currentFolderPath,
      (folderName, index) => {
        return html`
        <button class="breadcrumbs-folder"
          id="${this._breadcrumbsButtonPrefix}${index}"
          data-current=${index === this.currentFolderPath.length - 1 ? 1 : 0}
          data-index=${index}
          @click=${breadcrumbFolderOnClick}
        >
          ${this.rootFolderReady ? folderName : htmlSpinner()}
        </button>
      `;
      },
    );
    const breadcrumbs = join(
      breadcrumbsFolders,
      () => html`<span>&nbsp;&#x25B8;&nbsp;</span>`,
    );

    const upButtonOnClick = (event: MouseEvent) => {
      this.goToParentFolder(currentFolder);
      event.preventDefault();
      event.stopPropagation();
    };

    const upButton = html`
      <button
        id="up-button"
        title="Go up one folder"
        ?disabled=${this.currentFolderPath.length <= 1}
        @click=${upButtonOnClick}
      >
        ${htmlUpImage()}
      </button>
    `;

    const createNewFolder = (event: Event) => {
      const newFolderNameInput = this.shadowRoot?.getElementById(
        "new-folder-name",
      ) as HTMLInputElement | undefined;
      if (!newFolderNameInput) {
        return;
      }
      event.stopPropagation();
      const newFolderName = newFolderNameInput?.value ?? "";
      if (!newFolderName) {
        alert("New folder name cannot be empty");
        return;
      }
      if (newFolderName in currentFolder.entries) {
        alert(`Folder ${newFolderName} already exists`);
        return;
      }
      currentFolder.entries[newFolderName] = {
        name: newFolderName,
        isFolder: true,
        lastModifiedTimeMs: Date.now(),
        tags: [],
        entries: {},
      };
      newFolderNameInput.value = "";
      this.requestUpdate();
      this.saveToStorage();
    };

    const createNewFolderInputKeyboardHandler = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        createNewFolder(event);
        event.stopPropagation();
      }
    };

    return html`
      <div id="folder-tools">
        <div id="breadcrumbs" part="breadcrumbs">
          <div>Folder:</div>
          ${upButton}
          <div id="breadcrumbs-folders">
            ${breadcrumbs}
          </div>
        </div>
        <div id="new-folder">
          &emsp;
          <input
            type="text"
            id="new-folder-name"
            placeholder="Enter a new folder name to create"
            @keydown=${createNewFolderInputKeyboardHandler}
          >
          <button
            id="create-new-folder"
            @click=${createNewFolder}
          >
            Create new folder
          </button>
        </div>
      </div>
    `;
  }

  private clearSelection() {
    this.selection.clear();
    this.focusedEntry = undefined;
  }

  private computeScrollDimensions() {
    const container = this.shadowRoot?.getElementById("entry-table-container");
    const header = this.shadowRoot?.getElementById("entry-table-header");
    const body = this.shadowRoot?.getElementById("entry-table-body");
    if (!container || !header || !body) {
      throw new Error("table components not found");
    }
    const scrollViewTop = container.scrollTop;
    const scrollViewHeight = container.clientHeight - header.offsetHeight;
    const scrollViewBottom = scrollViewTop + scrollViewHeight;

    const getEntryOffset = (index: number) => {
      const row = this.shadowRoot?.getElementById(`entry-row-${index}`);
      if (!row) {
        throw new Error(`entry #${index} does not exist`);
      }
      const top = getRelativeOffset(container, row).top - header.offsetHeight;
      const height = row.offsetHeight;
      const bottom = top + height;
      return {
        row,
        top,
        height,
        bottom,
      };
    };
    return {
      container,
      header,
      body,
      scrollViewTop,
      scrollViewHeight,
      scrollViewBottom,
      getEntryOffset,
    };
  }

  private scrollToEntry(index: number) {
    try {
      const {
        container,
        scrollViewTop,
        scrollViewHeight,
        scrollViewBottom,
        getEntryOffset,
      } = this.computeScrollDimensions();

      const { top, bottom } = getEntryOffset(index);

      if (bottom <= scrollViewBottom && top >= scrollViewTop) {
        return;
      }
      if (bottom >= scrollViewBottom) {
        container.scrollTo({ top: bottom - scrollViewHeight });
      } else if (top < scrollViewTop) {
        container.scrollTo({ top });
      }
    } catch (error) {
      console.log(error);
    }
  }

  private findScrollIndex(
    entries: LibraryEntry[],
    index: number,
    direction: "up" | "down",
  ) {
    if (index < 0) {
      return entries.length === 0 ? -1 : 0;
    }
    try {
      const {
        scrollViewTop,
        scrollViewHeight,
        scrollViewBottom,
        getEntryOffset,
      } = this.computeScrollDimensions();

      if (direction === "down") {
        if (index >= entries.length - 1) {
          return entries.length - 1;
        }
        const { bottom: nextBottom } = getEntryOffset(index + 1);
        const targetViewBottom =
          scrollViewBottom +
          (nextBottom > scrollViewBottom ? scrollViewHeight : 0);
        let i = index;
        for (; i < entries.length - 1; ++i) {
          const { top: nextTop } = getEntryOffset(i + 1);
          if (nextTop > targetViewBottom) {
            break;
          }
        }
        return i;
      }
      if (index <= 0) {
        return 0;
      }
      const { top: previousTop } = getEntryOffset(index - 1);
      const targetViewTop =
        scrollViewTop - (previousTop < scrollViewTop ? scrollViewHeight : 0);
      let i = index;
      for (; i > 0; --i) {
        const { bottom: previousBottom } = getEntryOffset(i - 1);
        if (previousBottom < targetViewTop) {
          break;
        }
      }
      return i;
    } catch (error) {
      console.log(error);
      return -1;
    }
  }

  goToFolder(fromFolder: LibraryFolder, toFolder: LibraryFolder) {
    this.clearSelection();
    this.clearCache(fromFolder);
    this.currentFolderPath = [...this.currentFolderPath, toFolder.name];
    this.requestUpdate();
  }

  openEntry(currentFolder: LibraryFolder, entry: LibraryEntry) {
    if (entry.isFolder) {
      this.goToFolder(currentFolder, entry);
    }
  }

  selectEntry(entry: LibraryEntry) {
    this.selection.clear();
    this.focusedEntry = entry;
    this.selection.add(entry);
    this.requestUpdate();
  }

  toggleEntry(entry: LibraryEntry) {
    this.focusedEntry = entry;
    if (this.selection.has(entry)) {
      this.selection.delete(entry);
    } else {
      this.selection.add(entry);
    }
    this.requestUpdate();
  }

  selectRange(entries: LibraryEntry[], fromIndex: number, toIndex: number) {
    if (fromIndex < 0) {
      this.selection.add(entries[toIndex]);
    } else if (fromIndex < toIndex) {
      for (let i = fromIndex; i <= toIndex; ++i) {
        this.selection.add(entries[i]);
      }
    } else {
      for (let i = toIndex; i <= fromIndex; ++i) {
        this.selection.add(entries[i]);
      }
    }
    this.focusedEntry = entries[toIndex];
    this.requestUpdate();
  }

  moveFocus(
    entries: LibraryEntry[],
    fromIndex: number,
    toIndex: number,
    event: KeyboardEvent,
  ) {
    if (toIndex >= entries.length || toIndex < 0) {
      this.focusedEntry = undefined;
      return;
    }
    this.scrollToEntry(toIndex);
    if (event.shiftKey) {
      this.selectRange(entries, fromIndex, toIndex);
      return;
    }
    if (event.ctrlKey) {
      this.focusedEntry = entries[toIndex];
      return;
    }
    this.selectEntry(entries[toIndex]);
  }

  onKeyDown(
    entries: LibraryEntry[],
    currentFolder: LibraryFolder,
    focusedEntryIndex: number,
    event: KeyboardEvent,
  ) {
    switch (event.key) {
      case "ArrowUp": {
        this.moveFocus(
          entries,
          focusedEntryIndex,
          Math.max(focusedEntryIndex - 1, 0),
          event,
        );
        break;
      }
      case "ArrowDown": {
        this.moveFocus(
          entries,
          focusedEntryIndex,
          Math.min(focusedEntryIndex + 1, entries.length - 1),
          event,
        );
        break;
      }
      case "Home": {
        this.moveFocus(entries, focusedEntryIndex, 0, event);
        break;
      }
      case "End": {
        this.moveFocus(entries, focusedEntryIndex, entries.length - 1, event);
        break;
      }
      case " ": {
        this.toggleEntry(entries[focusedEntryIndex]);
        break;
      }
      case "PageUp": {
        const scrollIndex = this.findScrollIndex(
          entries,
          focusedEntryIndex,
          "up",
        );
        if (scrollIndex < 0) {
          return;
        }
        this.moveFocus(entries, focusedEntryIndex, scrollIndex, event);
        break;
      }
      case "PageDown": {
        const scrollIndex = this.findScrollIndex(
          entries,
          focusedEntryIndex,
          "down",
        );
        if (scrollIndex < 0) {
          return;
        }
        this.moveFocus(entries, focusedEntryIndex, scrollIndex, event);
        break;
      }
      case "a": {
        if (event.ctrlKey) {
          for (const entry of entries) {
            if (!this.selection.has(entry)) {
              this.selection.add(entry);
            }
          }
          this.requestUpdate();
          break;
        }
        return;
      }
      case "Enter": {
        if (this.focusedEntry?.isFolder) {
          this.goToFolder(currentFolder, this.focusedEntry);
        } else {
          this.submit("ok");
        }
        break;
      }
      case "Backspace": {
        this.goToParentFolder(currentFolder);
        break;
      }
      case "Escape": {
        this.submit("cancel");
        break;
      }
      case "f": {
        if (event.ctrlKey) {
          this.filterInput?.focus();
          break;
        }
        return;
      }
      case "/": {
        this.filterInput?.focus();
        break;
      }
      default: {
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }

  private htmlEntryTable(
    currentFolder: LibraryFolder,
    entries: LibraryEntry[],
    focusedEntryIndex: number,
  ) {
    const tableHeader =
      this.numColumns === 1
        ? html`
      <tr>
        <th class="entry-table-header">
          Preview
        </th>
        <th class="entry-table-header"
          @click=${() => this.toggleSortOrder("name")}
        >
          Name
          ${this.htmlSortOrder("name")}
        </th>
        <th class="entry-table-header"
          @click=${() => this.toggleSortOrder("time")}
        >
          Last modified
          ${this.htmlSortOrder("time")}
        </th>
        <th class="entry-table-header"
          @click=${() => this.toggleSortOrder("type")}
        >
          Type
          ${this.htmlSortOrder("type")}
        </th>
      </tr>
    `
        : html`
      <div class="full-width-item">
        Sort by:
        <div class="column">
        </div>
      </div>
    `;

    const onEntryDoubleClick = (entry: LibraryEntry, _index: number) => {
      return (event: Event) => {
        event.stopPropagation();
        this.openEntry(currentFolder, entry);
      };
    };

    const onEntryClick = (entry: LibraryEntry, index: number) => {
      return (event: MouseEvent) => {
        event.stopPropagation();
        if (event.shiftKey) {
          this.selectRange(entries, focusedEntryIndex, index);
          return;
        }
        if (event.ctrlKey) {
          this.toggleEntry(entry);
          return;
        }
        this.selectEntry(entry);
      };
    };

    const entryRowSelectedClass = (entry: LibraryEntry) => {
      return this.selection.has(entry) ? " entry-row-selected" : "";
    };

    const entryRowFocusedClass = (entry: LibraryEntry) => {
      return this.focusedEntry === entry ? " entry-row-focused" : "";
    };

    const preview = (entry: LibraryEntry) => {
      if (entry.isFolder) {
        return nothing;
      }
      const { asset } = entry;
      let url: string | undefined;
      if (asset.sourceType === "idb") {
        url = asset.dataUrl;
        if (!url) {
          const { key } = asset;
          deserialize(
            {
              type: "idb",
              dbName: this.idbDatabaseName,
              storeName: this.idbObjectStoreName,
              key,
              keyPath: this.idbKeyPath,
              valuePath: this.idbValuePath,
            },
            "dataurl",
          )
            .then((dataUrl) => {
              asset.dataUrl = dataUrl;
              this.requestUpdate();
            })
            .catch((error) => {
              console.log(`failed to load data URL for preview:`, error);
            });
          return htmlSpinner();
        }
      } else if (asset.sourceType === "url") {
        url = asset.url;
      } else {
        return html`Data source type not supported`;
      }

      const onClickPreview = (event: MouseEvent) => {
        if (event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          window.open(url, "_blank");
        } else if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          window.open(url);
        }
      };
      if (asset.type === "image") {
        return html`
          <img src=${url}
            @click=${onClickPreview}
            alt="image preview"
            title="Ctrl+click to open in a new tab\nShift+click to open in a new window"
          />
        `;
      }
      return html`
        <div @click=${onClickPreview}
          title="Ctrl+click to open in a new tab\nShift+click to open in a new window"
        >
          Preview not supported
        </div>`;
    };

    const item = (entry: LibraryEntry, index: number) => {
      const entryRowClasses =
        "entry-row" +
        entryRowSelectedClass(entry) +
        entryRowFocusedClass(entry);
      const onDoubleClick = onEntryDoubleClick(entry, index);
      const onClick = onEntryClick(entry, index);

      const type = entry.isFolder
        ? "folder"
        : (entry.asset.mimeType ?? entry.asset.type);

      return html`
        <tr class="${entryRowClasses}"
          id="entry-row-${index}"
          @click=${onClick}
          @dblclick=${onDoubleClick}
        >
          <td class="entry-preview"
            id="entry-preview-${index}"
          >
            ${preview(entry)}
          </td>
          <td class="entry-name"
            id="entry-name-${index}"
          >
            <div style="overflow: auto;">
              ${entry.isFolder ? htmlFolderImage() : nothing}
              <span style="white-space: pre">${entry.name}</span>
            </div>
          </td>
          <td class="entry-time"
            id="entry-time-${index}"
          >
            ${formatTime(entry.lastModifiedTimeMs)}
          </td>
          <td class="entry-type"
            id="entry-type-${index}"
          >
            ${type}
          </td>
        </tr>
      `;
    };

    const items = entries.map((entry, index) => {
      return item(entry, index);
    });

    const onKeyDown = (event: KeyboardEvent) => {
      this.onKeyDown(entries, currentFolder, focusedEntryIndex, event);
    };

    return html`
      <div id="entry-table-container">
        <table id="entry-table"
          tabindex="0"
          @keydown=${onKeyDown}
        >
          <thead id="entry-table-header">
            ${tableHeader}
          </thead>
          <tbody id="entry-table-body">
            ${items}
          </tbody>
        </table>
      </div>
    `;
  }

  private uploadFile(currentFolder: LibraryFolder, file: File) {
    const entryName = getCollisionFreeName(file.name, currentFolder.entries);
    const mimeType = file.type;
    const key = generateStorageKey(this.currentFolderPath, entryName);
    const idbLocation = this.getIDBLocation(key);
    try {
      serialize(file, idbLocation)
        .then(async () => {
          let type: "text" | "image" | "audio" | "video" = "text";
          if (mimeType.startsWith("video")) {
            type = "video";
          } else if (mimeType.startsWith("audio")) {
            type = "audio";
          } else if (mimeType.startsWith("image")) {
            type = "image";
          }
          const dataUrl = await deserialize(idbLocation, "dataurl");
          currentFolder.entries[entryName] = {
            name: entryName,
            tags: [],
            lastModifiedTimeMs: Date.now(),
            isFolder: false,
            asset: {
              sourceType: "idb",
              databaseName: this.idbDatabaseName,
              storeName: this.idbObjectStoreName,
              key,
              valuePath: this.idbValuePath,
              dataUrl,
              mimeType,
              type,
            },
          };
          this.requestUpdate();
          this.saveToStorage();
        })
        .catch((error) => {
          console.log("upload error:", error);
        });
    } catch (error) {}
  }

  private deleteSelectedEntries(currentFolder: LibraryFolder) {
    let numDeleted = 0;
    for (const entry of this.selection) {
      if (entry !== currentFolder.entries[entry.name]) {
        console.log(`mismatching entries with name: ${entry.name}`);
        continue;
      }
      if (entry.isFolder) {
        clearFolder(entry);
      } else {
        deleteAsset(entry);
      }
      delete currentFolder.entries[entry.name];
      ++numDeleted;
    }
    if (numDeleted) {
      this.saveToStorage();
      this.selection.clear();
      this.focusedEntry = undefined;
      this.requestUpdate();
    }
  }

  private importFromUrl(
    currentFolder: LibraryFolder,
    url: string,
    name?: string,
    mimeType?: string,
  ) {
    try {
      const urlObject = new URL(url);
      const entryName = name
        ? name
        : getDefaultNameFromUrl(urlObject, currentFolder.entries);

      const newEntry: LibraryAsset = {
        isFolder: false,
        name: entryName,
        lastModifiedTimeMs: Date.now(),
        tags: [],
        asset: {
          type: mimeType?.split("/", 1)[0] as any,
          mimeType,
          sourceType: "url",
          url: urlObject.href,
        },
      };

      currentFolder.entries[entryName] = newEntry;
      this.saveToStorage();
      this.requestUpdate();
    } catch (error) {
      alert(`${url} is not a valid URL`);
    }
  }

  private htmlAssetTools(currentFolder: LibraryFolder) {
    const onFilterInputEvent = (e: InputEvent) => {
      this.filter = (e.target as HTMLInputElement).value;
    };

    const onClickImportFromUrlButton = (e: Event) => {
      const importFromUrlDialog = this.shadowRoot?.getElementById(
        "import-from-url-dialog",
      ) as HTMLDialogElement | null;
      const urlInput = this.shadowRoot?.getElementById(
        "import-from-url-url-input",
      ) as HTMLInputElement | null;
      const nameInput = this.shadowRoot?.getElementById(
        "import-from-url-name-input",
      ) as HTMLInputElement | null;
      const okButton = this.shadowRoot?.getElementById(
        "import-from-url-ok-button",
      ) as HTMLInputElement | null;
      if (!importFromUrlDialog || !urlInput || !nameInput || !okButton) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      importFromUrlDialog.showModal();
      urlInput.value = "";
      nameInput.placeholder = "";
      urlInput.disabled = false;
      nameInput.disabled = false;
      okButton.disabled = true;
      urlInput.focus();
    };

    const importFromUrlButton = this.allowsCreation
      ? html`
        <button id="import-from-url-button"
          @click=${onClickImportFromUrlButton}
        >
          Import from URL...
        </button>
      `
      : nothing;

    const onClickUploadButton = (e: Event) => {
      const uploadInput = this.shadowRoot?.getElementById(
        "upload-input",
      ) as HTMLInputElement | null;
      if (!uploadInput) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      uploadInput.value = "";
      uploadInput.click();
    };

    const onFileSelected = (e: InputEvent) => {
      const uploadInput = e.target as HTMLInputElement;
      if (!uploadInput) {
        return;
      }
      if (!uploadInput.files || uploadInput.files.length <= 0) {
        return;
      }
      e.stopPropagation();
      for (const file of uploadInput.files) {
        this.uploadFile(currentFolder, file);
      }
    };

    const uploadButton = this.allowsCreation
      ? html`
        <div>
          <input type="file" id="upload-input"
            style="display: none;"
            @change=${onFileSelected}
          >
          <button id="upload-button"
            @click=${onClickUploadButton}
            style="width: 100%"
          >
            Upload...
          </button>
        </div>
      `
      : nothing;

    const onClickRenameButton = (e: Event) => {
      const { focusedEntry } = this;
      if (!focusedEntry) {
        alert(`Please focus on an entry to rename first.`);
        return;
      }
      const renameDialog = this.shadowRoot?.getElementById(
        "rename-dialog",
      ) as HTMLDialogElement | null;
      const nameInput = this.shadowRoot?.getElementById(
        "rename-name-input",
      ) as HTMLInputElement | null;
      if (!renameDialog || !nameInput) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      nameInput.value = focusedEntry.name;
      renameDialog.showModal();
      nameInput.focus();
      nameInput.select();
    };

    const renameButton = this.allowsRenaming
      ? html`
        <button id="rename-button"
          @click=${onClickRenameButton}
        >
          Rename...
        </button>
      `
      : nothing;

    const onClickDeleteButton = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.deleteSelectedEntries(currentFolder);
    };

    const deleteButton = this.allowsDeletion
      ? html`
        <button id="delete-button"
          @click=${onClickDeleteButton}
        >
          Delete
        </button>
      `
      : nothing;

    return html`
      <div id="asset-tools">
        ${importFromUrlButton}
        ${uploadButton}
        ${renameButton}
        ${deleteButton}
        <span id="filter">
          <label for="filter-input">&emsp;Filter:&nbsp</label>
          <input type="text" id="filter-input"
            placeholder="Enter a part of asset names"
            @input=${onFilterInputEvent}
            autofocus
          >
        </span>
      </div>
    `;
  }

  private htmlSelectOptions() {
    const onClickOkButton = (event: MouseEvent) => {
      event.preventDefault();
      this.submit("ok");
    };
    const onClickCancelButton = (event: MouseEvent) => {
      event.preventDefault();
      this.submit("cancel");
    };
    const okButton =
      this.selectMode === "none"
        ? nothing
        : html`
      <button id="ok-button"
        @click=${onClickOkButton}
      >
        ${this.okButtonText ? this.okButtonText : "Ok"}
      </button>
    `;
    const cancelButton = html`
      <button id="cancel-button"
        @click=${onClickCancelButton}
      >
        ${
          this.cancelButtonText
            ? this.cancelButtonText
            : this.selectMode === "none"
              ? "Close"
              : "Cancel"
        }
      </button>
    `;
    return html`
      <div id="select-options">
        ${okButton}
        ${cancelButton}
      </div>
    `;
  }

  private submit(eventType: "ok" | "cancel") {
    this.dispatchEvent(
      new AssetLibraryEvent(
        eventType,
        createSelectedAssetList(Array.from(this.selection)),
      ),
    );
  }

  private htmlImportFromUrlDialog(currentFolder: LibraryFolder) {
    const updateInputStates = (active: boolean = true) => {
      const urlInput = this.shadowRoot?.getElementById(
        "import-from-url-url-input",
      ) as HTMLInputElement | null;
      const nameInput = this.shadowRoot?.getElementById(
        "import-from-url-name-input",
      ) as HTMLInputElement | null;
      const okButton = this.shadowRoot?.getElementById(
        "import-from-url-ok-button",
      ) as HTMLButtonElement | null;
      if (!urlInput || !nameInput || !okButton) {
        return;
      }
      if (!active) {
        urlInput.disabled = true;
        nameInput.disabled = true;
        okButton.disabled = true;
        return;
      }
      urlInput.disabled = false;
      nameInput.disabled = false;

      try {
        const url = new URL(urlInput.value);
        nameInput.placeholder = getDefaultNameFromUrl(
          url,
          currentFolder.entries,
        );
        okButton.disabled = false;
        okButton.title = "Click to accept";
      } catch (_error) {
        okButton.disabled = true;
        okButton.title = "URL is not valid";
      }
    };

    const submit = (ok: boolean) => {
      const dialog = this.shadowRoot?.getElementById(
        "import-from-url-dialog",
      ) as HTMLDialogElement | null;
      if (!dialog) {
        return;
      }
      if (ok) {
        const urlInput = this.shadowRoot?.getElementById(
          "import-from-url-url-input",
        ) as HTMLInputElement | null;
        const nameInput = this.shadowRoot?.getElementById(
          "import-from-url-name-input",
        ) as HTMLInputElement | null;
        if (!urlInput || !nameInput) {
          dialog.close();
          return;
        }
        const name = nameInput.value ? nameInput.value : nameInput.placeholder;
        if (name in currentFolder.entries) {
          const entryString = currentFolder.entries[name].isFolder
            ? "A folder"
            : "An asset";
          alert(
            `${entryString} with name "${name}" already exists.\n` +
              `Please choose a different name.`,
          );
          return;
        }
        const url = urlInput.value;
        updateInputStates(false);
        let mimeType = "";
        try {
          fetchMimeType(url)
            .then((fetchedMimeType) => {
              mimeType = fetchedMimeType ?? "";
            })
            .catch((error) => {
              console.log(`failed to fetch MIME type from ${url}:`, error);
            })
            .finally(() => {
              this.importFromUrl(currentFolder, url, name, mimeType);
              dialog.close();
              updateInputStates(true);
              if (!mimeType) {
                alert("Failed to retrieve the MIME type. Default to unknown.");
              }
            });
        } catch (error) {
          console.log(`failed to fetch MIME type from ${url}:`, error);
        }
      } else {
        dialog.close();
      }
    };

    const onClick = (event: MouseEvent, ok: boolean) => {
      submit(ok);
      event.preventDefault();
      event.stopPropagation();
    };

    const onClickOkButton = (event: MouseEvent) => onClick(event, true);
    const onClickCancelButton = (event: MouseEvent) => onClick(event, false);

    const onInputUrl = (event: InputEvent) => {
      updateInputStates();
      event.stopPropagation();
    };

    const onInputName = (event: InputEvent) => {
      event.stopPropagation();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Enter": {
          submit(true);
          break;
        }
        case "Escape": {
          submit(false);
          break;
        }
        default: {
          return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const onClose = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      submit(false);
    };

    const windowHeaderTag = unsafeStatic(WindowHeader.register());
    return shtml`
      <dialog
        id="import-from-url-dialog"
        style="border-radius: 0.5em; overflow: clip;"
        tabindex=-1
        @keydown=${onKeyDown}
      >
        <${windowHeaderTag} text="Import asset from URL"
          @close=${onClose}
        >
          <div id="import-from-url-dialog-content">
            <div id="import-from-url-input-section">
              <label for="import-from-url-url-input">URL:</label>
              <input type="text" id="import-from-url-url-input"
                @input=${onInputUrl}
              />
              <label for="import-from-url-name-input">Asset name:</label>
              <input type="text" id="import-from-url-name-input"
                @input=${onInputName}
              />
            </div>
            <div id="import-from-url-button-section">
              <button id="import-from-url-ok-button"
                @click=${onClickOkButton}
                title="URL is not valid"
                disabled
              >Ok</button>
              <button id="import-from-url-cancel-button"
                @click=${onClickCancelButton}
              />Cancel</button>
            </div>
          </div>
        </${windowHeaderTag}>
      </dialog>
    `;
  }

  private rename(
    currentFolder: LibraryFolder,
    fromName: string,
    toName: string,
  ) {
    if (!(fromName in currentFolder.entries)) {
      return false;
    }
    if (fromName === toName) {
      return true;
    }
    if (toName in currentFolder.entries) {
      return false;
    }
    const sourceEntry = currentFolder.entries[fromName];
    const destinationEntry = { ...sourceEntry, name: toName };
    currentFolder.entries[toName] = destinationEntry;
    delete currentFolder.entries[fromName];
    this.saveToStorage();
    this.requestUpdate();
    return true;
  }

  private htmlRenameDialog(currentFolder: LibraryFolder) {
    const updateInputStates = () => {
      const nameInput = this.shadowRoot?.getElementById(
        "rename-name-input",
      ) as HTMLInputElement | null;
      const okButton = this.shadowRoot?.getElementById(
        "rename-ok-button",
      ) as HTMLButtonElement | null;
      const { focusedEntry } = this;
      if (!focusedEntry || !nameInput || !okButton) {
        return;
      }
      const currentName = focusedEntry.name;
      const name = nameInput.value;
      if (!name) {
        okButton.disabled = true;
        okButton.title = "Invalid name";
        return;
      }
      if (name !== currentName && name in currentFolder.entries) {
        okButton.disabled = true;
        const entryString = currentFolder.entries[name].isFolder
          ? "A folder"
          : "An asset";
        okButton.title = `${entryString} with that name already exists`;
        return;
      }
      okButton.disabled = false;
      okButton.title = "Accept";
    };

    const submit = (ok: boolean) => {
      const dialog = this.shadowRoot?.getElementById(
        "rename-dialog",
      ) as HTMLDialogElement | null;
      const { focusedEntry } = this;
      if (!focusedEntry || !dialog) {
        return;
      }
      if (ok) {
        const nameInput = this.shadowRoot?.getElementById(
          "rename-name-input",
        ) as HTMLInputElement | null;
        if (!nameInput) {
          dialog.close();
          return;
        }
        const currentName = focusedEntry.name;
        const name = nameInput.value ?? "";
        if (!name) {
          alert(`An asset name cannot be empty.`);
          return;
        }
        if (name === currentName) {
          dialog.close();
          return;
        }
        if (name in currentFolder.entries) {
          alert(
            `An asset with name "${name}" already exists.\n` +
              `Please choose a different name.`,
          );
          return;
        }
        if (!this.rename(currentFolder, currentName, name)) {
          alert(`Failed to rename "${currentName}" to "${name}".`);
        } else {
          dialog.close();
          return;
        }
      } else {
        dialog.close();
        return;
      }
    };

    const onClick = (event: MouseEvent, ok: boolean) => {
      submit(ok);
      event.preventDefault();
      event.stopPropagation();
    };

    const onClickOkButton = (event: MouseEvent) => onClick(event, true);
    const onClickCancelButton = (event: MouseEvent) => onClick(event, false);

    const onInputName = (event: InputEvent) => {
      updateInputStates();
      event.stopPropagation();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Enter": {
          submit(true);
          break;
        }
        case "Escape": {
          submit(false);
          break;
        }
        default: {
          return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const onClose = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      submit(false);
    };

    const windowHeaderTag = unsafeStatic(WindowHeader.register());
    return shtml`
      <dialog
        id="rename-dialog"
        style="border-radius: 0.5em; overflow: clip;"
        tabindex=-1
        @keydown=${onKeyDown}
      >
        <${windowHeaderTag} text="Rename asset"
          @close=${onClose}
        >
          <div id="rename-dialog-content">
            <div id="rename-input-section">
              <label for="rename-name-input">New name:</label>
              <input type="text" id="rename-name-input"
                @input=${onInputName}
              />
            </div>
            <div id="rename-button-section">
              <button id="rename-ok-button"
                @click=${onClickOkButton}
              >Ok</button>
              <button id="rename-cancel-button"
                @click=${onClickCancelButton}
              />Cancel</button>
            </div>
          </div>
        </${windowHeaderTag}>
      </dialog>
    `;
  }

  render() {
    const currentFolder = this.getEntryFromPath(
      this.currentFolderPath,
    ) as LibraryFolder;
    const entries = this.getEntryList(currentFolder, this.filter);
    const focusedEntryIndex = entries.findIndex(
      (entry) => entry === this.focusedEntry,
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }
      if (event.target instanceof HTMLInputElement && event.key !== "Escape") {
        return;
      }
      if (
        event.target instanceof HTMLButtonElement &&
        (event.key === "Enter" || event.code === "Space")
      ) {
        return;
      }
      this.onKeyDown(entries, currentFolder, focusedEntryIndex, event);
    };

    return html`
      <div id="container"
        tabindex="-1"
        @keydown=${onKeyDown}
      >
        ${this.htmlFolderTools(currentFolder)}
        ${this.htmlEntryTable(currentFolder, entries, focusedEntryIndex)}
        ${this.htmlAssetTools(currentFolder)}
        ${this.htmlSelectOptions()}
        <div>
          <button @click=${() => {
            console.log(JSON.stringify(this.rootFolder, undefined, 2));
          }}>
            Dump
          </button>
        </div>
      </div>
      ${this.htmlImportFromUrlDialog(currentFolder)}
      ${this.htmlRenameDialog(currentFolder)}
    `;
  }

  serializeState() {}

  deserializeState() {}

  /**
   * Returns a structured-cloneable object that represents this.
   */
  serializeData() {
    return structuredClone(this.rootFolder);
  }

  deserializeData(data: string): this;
  deserializeData(data: LibraryFolder): this;
  deserializeData(data: string | LibraryFolder) {
    if (typeof data === "string") {
      this.rootFolder = JSON.parse(data);
    } else {
      this.rootFolder = structuredClone(data);
    }
    return this;
  }

  @state()
  private rootFolderReady: boolean = false;

  async initStorage() {
    try {
      if (
        this.idbDatabaseName &&
        this.idbObjectStoreName &&
        this.idbKeyPath &&
        this.idbValuePath
      ) {
        await initIDBStores(this.idbDatabaseName, [
          {
            name: this.idbObjectStoreName,
            keyPath: this.idbKeyPath,
          },
        ]);
        await this.loadFromIDB();
      }
    } catch (error) {
      console.log(`failed to initialize storage:`, error);
    }
    this.rootFolderReady = true;
  }

  async saveToStorage() {
    try {
      if (
        this.idbDatabaseName &&
        this.idbObjectStoreName &&
        this.idbKeyPath &&
        this.idbValuePath
      ) {
        const root = pruneCache(this.rootFolder);
        await this.saveToIDB(root);
      }
    } catch (error) {
      console.log(`failed to save data to storage:`, error);
    }
  }

  async loadFromStorage() {
    try {
      if (
        this.idbDatabaseName &&
        this.idbObjectStoreName &&
        this.idbKeyPath &&
        this.idbValuePath
      ) {
        await this.loadFromIDB();
      }
    } catch (error) {
      console.log(`failed to load data from storage:`, error);
      this.rootFolder = {
        name: "root",
        tags: [],
        lastModifiedTimeMs: -1,
        isFolder: true,
        entries: {},
      };
      this.currentFolderPath = [this.rootFolder.name];
    }
  }

  private getIDBLocation(key: string = ""): IDBLocation {
    return {
      type: "idb",
      dbName: this.idbDatabaseName,
      storeName: this.idbObjectStoreName,
      key,
      keyPath: this.idbKeyPath,
      valuePath: this.idbValuePath,
    };
  }

  private isSavingToIDB: boolean = false;

  async initIDBStore() {
    await initIDBStores(this.idbDatabaseName, [
      {
        name: this.idbObjectStoreName,
        keyPath: this.idbKeyPath,
      },
    ]);
  }

  async saveToIDB(root: LibraryFolder) {
    if (this.isSavingToIDB) {
      return;
    }
    this.isSavingToIDB = true;
    await serialize(root, this.getIDBLocation());
    await new Promise((res) => setTimeout(res, IDB_WRITE_PERIOD_MS));
    await serialize(root, this.getIDBLocation());
    this.isSavingToIDB = false;
  }

  async loadFromIDB() {
    this.rootFolder = await deserialize(this.getIDBLocation(), "object");
    this.currentFolderPath = [this.rootFolder.name];
  }

  connectedCallback() {
    super.connectedCallback();
    this.initStorage();
  }

  addEventListener(
    type: "ok" | "cancel",
    listener: (event: AssetLibraryEvent) => any,
    options?: Parameters<LitElement["addEventListener"]>[2],
  ): void;
  addEventListener(...p: Parameters<LitElement["addEventListener"]>): void;
  addEventListener(...p: [any, any, any]): void;
  addEventListener(...p: [any, any, any]) {
    super.addEventListener(...p);
  }
}

function htmlUpImage() {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg"
      height="1.2em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M 12 21 V 5"></path>
      <polyline points="5 12 12 5 19 12"></polyline>
    </svg>
  `;
}

function htmlFolderImage() {
  return html`
    <svg
      height="1.2em"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style="vertical-align: middle"
    >
      <rect
        x="10" y="20"
        width="80" height="60"
        rx="5" ry="5"
        fill="#c0ff90" stroke="#333" stroke-width="2"
      />
      <rect
        x="15" y="15"
        width="70" height="10"
        rx="2" ry="2"
        fill="#333"
      />
    </svg>
  `;
}

function htmlSpinner(height: string = "1lh") {
  return html`
    <svg
      height="${height}"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="gradient-spinner"
          x1="0%" y1="0%" x2="100%" y2="0%"
        >
          <stop offset="0%" stop-color="#4488dd" />
          <stop offset="50%" stop-color="#aaaaaa" />
          <stop offset="100%" stop-color="#ef9c84" />
        </linearGradient>
      </defs>
      <circle class="spinner"
        cx="50" cy="50" r="40"
        fill="none"
        stroke-width="20"
        stroke="url(#gradient-spinner)"
        stroke-linecap="round"
      />
    </svg>
  `;
}

function formatTime(timestampMs: number | null | undefined) {
  if (timestampMs == null || timestampMs <= 0) {
    return "unknown";
  }
  return new Date(timestampMs).toLocaleString();
}

function composeComparers<T>(comparers: ((a: T, b: T) => number)[]) {
  return (a: T, b: T) => {
    for (const comparer of comparers) {
      const result = comparer(a, b);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  };
}

function reverseCompare<T>(compare: (a: T, b: T) => number) {
  return (a: T, b: T) => -compare(a, b);
}

function pruneObject(obj: any, filter: (key: string, value: any) => boolean) {
  if ((typeof obj !== "object" && typeof obj !== "function") || !obj) {
    return obj;
  }
  const result: Record<string, any> = {};
  for (const key in obj) {
    const value = obj[key];
    if (filter(key, value)) {
      result[key] = pruneObject(value, filter);
    }
  }
  return result;
}

function pruneCache(obj: any) {
  return pruneObject(obj, (key) => key !== "dataUrl");
}

function createSelectedAssetList(entries: LibraryEntry[]): LibraryAsset[] {
  return entries.flatMap((entry) => {
    if (entry.isFolder) {
      return createSelectedAssetList(Object.values(entry.entries));
    }
    return [entry];
  });
}

export async function getAssetData(asset: AssetSource) {
  switch (asset.sourceType) {
    case "idb": {
      const { databaseName, storeName, key, valuePath, dataUrl } = asset;
      if (dataUrl) {
        return dataUrl;
      }
      const idbLocation: IDBLocation = {
        type: "idb",
        dbName: databaseName,
        storeName,
        key,
        valuePath,
      };
      asset.dataUrl = await deserialize(idbLocation, "dataurl");
      return asset.dataUrl;
    }
    case "url": {
      return asset.url;
    }
  }
  return undefined;
}

function clearFolder(folder: LibraryFolder) {
  for (const [name, entry] of Object.entries(folder.entries)) {
    if (entry.isFolder) {
      clearFolder(entry);
    } else {
      deleteAsset(entry).catch((error) => {
        console.log(`failed to delete asset ${entry.name}:`, error);
      });
    }
    delete folder.entries[name];
  }
}

async function deleteAsset(entry: LibraryAsset) {
  const { asset } = entry;
  switch (asset.sourceType) {
    case "idb": {
      const idbLocation: IDBLocation = {
        type: "idb",
        dbName: asset.databaseName,
        storeName: asset.storeName,
        key: asset.key,
      };
      await deleteFromStorage(idbLocation);
      break;
    }
  }
}

function getCollisionFreeName(
  name: string,
  existingRecord: Record<string, any>,
) {
  if (name in existingRecord) {
    let stem = name;
    let extension = "";
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex >= 0) {
      stem = name.slice(0, dotIndex);
      extension = name.slice(dotIndex + 1);
    }
    for (let i = 1; name in existingRecord; ++i) {
      if (extension) {
        name = `${stem}~${i}.${extension}`;
      } else {
        name = `${stem}~${i}`;
      }
    }
  }
  return name;
}

function getDefaultNameFromUrl(
  urlObject: URL,
  existingRecord: Record<string, any>,
) {
  const { pathname } = urlObject;
  const lastSegment = pathname.split("/").pop();
  return getCollisionFreeName(
    lastSegment ? lastSegment : pathname ? pathname : urlObject.href,
    existingRecord,
  );
}

function generateStorageKey(folderPath: string[], entryName: string) {
  return (
    folderPath.join("\n") +
    "\n" +
    entryName +
    "\n" +
    randomUUID() +
    "\n" +
    performance.now()
  );
}
