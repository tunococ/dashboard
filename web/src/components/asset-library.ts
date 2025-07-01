import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { join } from "lit/directives/join.js";
import { map } from "lit/directives/map.js";
import { deserialize, IDBLocation, initIDBStores, serialize } from "../browser-utils/serialization";

// Limit writing to IDB to at most once per second.
const IDB_WRITE_PERIOD_MS = 1000;

export type SortBy = "name" | "time" | "type"

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

export type MediaAsset = TextAsset | ImageAsset | AudioAsset | VideoAsset

export type Asset = MediaAsset;

export type AssetSource = Asset & DataSource;

export type LibraryEntry = {
  name: string;
  tags: string[];
  lastModifiedTimeMs: number;
  selected?: boolean;
} & ({
  isFolder: false;
  asset: AssetSource;
} | {
  isFolder: true;
  entries: Record<string, LibraryEntry>;
});

export type LibraryFolder = LibraryEntry & { isFolder: true; };

export type UserLibraryDialogProperties = {
  title: string;
  rootEntry: LibraryEntry & { isFolder: true; };
  allowsCreation: boolean;
  allowsDeletion: boolean;
  allowsRenaming: boolean;
  selectMode: "none" | "single" | "multiple";
  selectButtonText?: string;
  cancelButtonText?: string;
  filter?: string;
  sortOptions: {
    by: SortBy;
    ascending: boolean;
  }[];
  numColumns: number;
  keyboardIndex?: number;
  preview: (file: File) => HTMLElement;
};

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
      return tagName;
    } else {
      return AssetLibrary.tagName;
    }
  }

  constructor() {
    super();
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

  @state()
  protected breadcrumbsFolders: LibraryFolder[] = [this.rootFolder];

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
  selectButtonText: string = "Ok";

  @property()
  cancelButtonText: string = "Cancel";

  @property()
  filter: string = "";

  @property({ type: Array })
  sortOrders: { key: "name" | "time" | "type"; ascending: boolean; }[] = [
    {
      key: "name",
      ascending: true,
    },
    {
      key: "time",
      ascending: false,
    },
    {
      key: "type",
      ascending: true,
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
  selection: Set<LibraryEntry> = new Set();

  @state()
  focusedEntry?: LibraryEntry;

  @state()
  focusedEntryIndex: number = -1;

  static get styles() {
    return css`
      :host {
        all: inherit;
        border: 0;
        padding: 0;
        box-sizing: border-box;
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      #container {
        position: relative;
        width: 100%;
        height: 100%;
        border: 0;
        border-radius: 0.3em;
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
        padding: 0.1em 1em;
      }

      #up-button {
        margin: 1em;
      }

      #breadcrumbs {
        display: flex;
        flex-direction: row;
        align-items: center;
      }

      .breadcrumbs-folder {
        cursor: pointer;
      }

      #new-folder {
        flex-grow: 1;
        display: flex;
        flex-direction: row;
        align-items: center;
      }

      #new-folder input[type="text"] {
        flex-grow: 1;
        margin-left: 2em;
        margin-right: 0.5em;
      }

      /* item-grid section */

      #item-grid-container {
        flex-grow: 1;
        align-self: center;
        width: calc(100% - 2em);
        border: 0.05em solid var(--item-grid-border-color, #0000ff);
        background-color: var(--item-grid-background-color, #fdfdfd);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: start;
        overflow: auto;
      }

      #item-grid {
        display: grid;
        width: 100%;
        align-items: start;
        grid-template-columns: minmax(15%, 1fr) minmax(15%, 1fr) auto auto;
      }

      #item-grid > * {
        align-self: stretch;
        padding-top: 0.25em;
        padding-bottom: 0.25em;
      }

      #item-grid * {
        user-select: none;
      }

      .grid-header {
        width: 100%;
        padding: 0.5em 1em;
        text-align: center;
        user-select: none;
      }

      .grid-header:nth-of-type(2n) {
        background-color: #f8f8ff;
      }

      .grid-header:nth-of-type(2n + 1) {
        background-color: #f0f0ff;
      }

      .entry-preview {
        width: 100%;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .entry-preview img {
        max-width: 100%;
      }

      .entry-name {
        width: 100%;
        position: relative;
        padding: 0 0.5em;
        display: inline;
        justify-content: start;
        align-content: center;
        overflow: auto;
        white-space: nowrap;
      }

      .entry-time {
        width: 100%;
        position: relative;
        padding: 0 0.5em;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .entry-type {
        width: 100%;
        position: relative;
        padding: 0 0.5em;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .single-column-entry {
        border-top: 0.05em solid transparent;
        border-bottom: 0.05em solid transparent;
      }

      .entry-selected {
        color: var(--selection-color, #ffffff);
        background-color: var(--selection-background-color, #6060ff);
      }

      .entry-focused {
        border-top: 0.05em dashed var(--focused-selection-color, #ffffff);
        border-bottom: 0.05em dashed var(--focused-selection-color, #ffffff);
        color: var(--focused-selection-color, #ffffff);
        background-color: var(--focused-selection-background-color, #0000ff);
      }

      .entry-focused:not(.entry-selected) {
        border-top: 0.05em dashed var(--focused-color, #000000);
        border-bottom: 0.05em dashed var(--focused-color, #000000);
        color: var(--focused-color, #000000);
        background-color: var(--focused-background-color, #f0f0ff);
      }

      .full-width-item {
        grid-column: 1 / -1;
      }

      /* select-options section */

      #select-options {
        padding: 0 1em;
        display: flex;
        flex-direction: row;
        column-gap: 1em;
        justify-content: end;
      }

      /* asset-tools section */

      #asset-tools {
        padding: 1em;
        display: flex;
        flex-direction: row;
        justify-content: center;
        column-gap: 0.5em;
        padding-left: 1em;
        padding-right: 1em;
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
    const compareFolders = (a: LibraryEntry, b: LibraryEntry) => {
      return (a.isFolder ? 0 : 1) - (b.isFolder ? 0 : 1);
    };
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
      "name": compareNames,
      "time": compareTimes,
      "type": compareTypes,
    };
    const comparers: ((a: LibraryEntry, b: LibraryEntry) => number)[] = [compareFolders];
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
      (${index + 1}${this.sortOrders[index].ascending ? html`&#x25B2;` : html`&#x25BC`
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
    })
    this.requestUpdate();
  }

  updated() {
    if (this.shadowRoot) {
    }
  }

  private htmlFolderTools(currentFolder: LibraryFolder) {
    const breadcrumbFolderOnClick = (event: MouseEvent) => {
      if (event.target instanceof HTMLElement &&
        event.target.id.startsWith(this._breadcrumbsButtonPrefix)) {
        const index = parseInt(event.target.dataset["index"] ?? "-1");
        if (index >= 0 && index + 1 < this.currentFolderPath.length) {
          this.clearSelection();
          this.currentFolderPath =
            this.currentFolderPath.slice(0, index + 1);
        }
        event.stopPropagation();
      }
    }
    const breadcrumbsFolders = map(this.currentFolderPath, (folderName, index) => {
      return html`
        <span class="breadcrumbs-folder"
          id="${this._breadcrumbsButtonPrefix}${index}"
          data-index=${index}
          @click=${breadcrumbFolderOnClick}
        >
          ${folderName}
        </span>
      `;
    });
    const breadcrumbs = join(breadcrumbsFolders, () => html`&nbsp;&#x25B8;&nbsp;`);

    const upButtonOnClick = (event: MouseEvent) => {
      if (this.currentFolderPath.length <= 1) {
        return;
      }
      this.clearSelection();
      this.currentFolderPath = this.currentFolderPath.slice(0, -1);
      event.stopPropagation();
    }

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
      const newFolderNameInput = this.shadowRoot
        ?.getElementById("new-folder-name") as (HTMLInputElement | undefined);
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
          Folder:
          ${upButton}
          ${breadcrumbs}
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
    this.focusedEntryIndex = -1;
    this.focusedEntry = undefined;
  }

  private htmlItemGrid(entries: LibraryEntry[]) {
    const gridHeader = this.numColumns === 1 ? html`
      <div class="grid-header">
        Preview
      </div>
      <div id="name-column-header" class="grid-header"
        @click=${() => this.toggleSortOrder("name")}
      >
        Name
        ${this.htmlSortOrder("name")}
      </div>
      <div id="time-column-header" class="grid-header"
        @click=${() => this.toggleSortOrder("time")}
      >
        Last modified
        ${this.htmlSortOrder("time")}
      </div>
      <div id="type-column-header" class="grid-header"
        @click=${() => this.toggleSortOrder("type")}
      >
        Type
        ${this.htmlSortOrder("type")}
      </div>
    ` :
      html`
      <div class="full-width-item">
        Sort by:
        <div class="column">
        </div>
      </div>
    `;

    const goToFolder = (entry: LibraryEntry) => {
      this.clearSelection();
      this.currentFolderPath = [...this.currentFolderPath, entry.name];
      this.requestUpdate();
    };

    const openEntry = (entry: LibraryEntry, _index: number) => {
      if (entry.isFolder) {
        goToFolder(entry);
      }
    };

    const selectEntry = (entry: LibraryEntry, index: number) => {
      this.selection.clear();
      this.focusedEntryIndex = index;
      this.focusedEntry = entry;
      this.selection.add(entry);
      this.requestUpdate();
    };

    const toggleEntry = (entry: LibraryEntry, index: number) => {
      this.focusedEntryIndex = index;
      this.focusedEntry = entry;
      if (this.selection.has(entry)) {
        this.selection.delete(entry);
      } else {
        this.selection.add(entry);
      }
      this.requestUpdate();
    };

    const selectRange = (entry: LibraryEntry, index: number) => {
      if (this.focusedEntryIndex < 0) {
        selectEntry(entry, index);
        return;
      }
      if (this.focusedEntryIndex < index) {
        for (let i = this.focusedEntryIndex; i <= index; ++i) {
          this.selection.add(entries[i]);
        }
      } else {
        for (let i = index; i <= this.focusedEntryIndex; ++i) {
          this.selection.add(entries[i]);
        }
      }
      this.focusedEntryIndex = index;
      this.focusedEntry = entry;
      this.requestUpdate();
    };

    const onEntryDoubleClick = (entry: LibraryEntry, index: number) => {
      return (event: Event) => {
        event.stopPropagation();
        openEntry(entry, index);
      };
    };

    const onEntryClick = (entry: LibraryEntry, index: number) => {
      return (event: MouseEvent) => {
        event.stopPropagation();
        if (event.shiftKey) {
          selectRange(entry, index);
          return;
        }
        if (event.ctrlKey) {
          toggleEntry(entry, index);
          return;
        }
        selectEntry(entry, index);
      };
    };

    const entrySelectedClass = (entry: LibraryEntry) => {
      return this.selection.has(entry) ? " entry-selected" : "";
    };

    const entryFocusedClass = (entry: LibraryEntry) => {
      return this.focusedEntry === entry ? " entry-focused" : "";
    };

    const preview = (entry: LibraryEntry) => {
      if (entry.isFolder) {
        return nothing;
      }
      const { asset } = entry;
      if (asset.type === "image") {
        if (asset.sourceType === "idb") {
          if (asset.dataUrl) {
            return html`<img src=${asset.dataUrl} style="preview"/>`;
          } else {
            const key = getStorageKeyForEntryPath([...this.currentFolderPath, entry.name]);
            deserialize({
              type: "idb",
              dbName: this.idbDatabaseName,
              storeName: this.idbObjectStoreName,
              key,
              keyPath: this.idbKeyPath,
              valuePath: this.idbValuePath,
            }, "dataurl").then(dataUrl => {
              asset.dataUrl = dataUrl;
              this.requestUpdate();
            }).catch(error => {
              console.log(`failed to load data URL for preview:`, error);
            });
          }
        }
      }
      return nothing;
    };

    const item = (entry: LibraryEntry, index: number) => {
      const highlightClasses =
        " single-column-entry" +
        entrySelectedClass(entry) +
        entryFocusedClass(entry);
      const onDoubleClick = onEntryDoubleClick(entry, index);
      const onClick = onEntryClick(entry, index);

      const type = entry.isFolder ? "folder" : (
        entry.asset.mimeType ?? entry.asset.type
      );

      return html`
        <div class="entry-preview${highlightClasses}"
          @click=${onClick}
          @dblclick=${onDoubleClick}
        >
          ${preview(entry)}
        </div>
        <div id="folder-${entry.name}" class="entry-name${highlightClasses}"
          @click=${onClick}
          @dblclick=${onDoubleClick}
        >
          ${entry.isFolder ? htmlFolderImage() : nothing}
          ${entry.name}
        </div>
        <div class="entry-time${highlightClasses}"
          @click=${onClick}
          @dblclick=${onDoubleClick}
        >
          ${formatTime(entry.lastModifiedTimeMs)}
        </div>
        <div class="entry-type${highlightClasses}"
          @click=${onClick}
          @dblclick=${onDoubleClick}
        >
          ${type}
        </div>
      `;
    };

    const items = entries.map((entry, index) => {
      return item(entry, index);
    });

    return html`
      <div id="item-grid-container">
        <div id="item-grid">
          ${gridHeader}
          ${items}
        </div>
      </div>
    `;
  }

  private uploadFile(currentFolder: LibraryFolder, file: File) {
    let entryName = file.name;
    const mimeType = file.type;
    if (entryName in currentFolder.entries) {
      const parts = file.name.split(".");
      const stem = parts.slice(0, -1).join("");
      const extension = parts[parts.length - 1];
      for (let i = 1; entryName in currentFolder.entries; ++i) {
        entryName = `${stem}~${i}.${extension}`;
      }
    }
    const key = this.currentFolderPath.join("\n") + "\n" + entryName;
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
        }).catch((error) => {
          console.log("upload error:", error);
        });
    } catch (error) {
    }
  }

  private htmlAssetTools(currentFolder: LibraryFolder) {
    const onFilterInputEvent = (e: InputEvent) => {
      this.filter = (e.target as HTMLInputElement).value;
    };

    const importFromUrl = (e: Event) => {
      e.stopPropagation();
      // TODO: Create a dialog for URL input
    };

    const importFromUrlButton = this.allowsCreation ?
      html`
        <button id="import-from-url-button"
          @click=${importFromUrl}
        >
          Import from URL...
        </button>
      ` : nothing;

    const upload = (e: Event) => {
      const uploadInput = this.shadowRoot?.getElementById("upload-input") as
        HTMLInputElement;
      if (!uploadInput) {
        return;
      }
      e.stopPropagation();
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

    const uploadButton = this.allowsCreation ?
      html`
        <div>
          <input type="file" id="upload-input"
            style="display: none;"
            @change=${onFileSelected}
          >
          <button id="upload-button"
            @click=${upload}
            style="width: 100%"
          >
            Upload...
          </button>
        </div>
      ` : nothing;

    const renameButton = this.allowsRenaming ?
      html`
        <button id="rename-button">
          Rename...
        </button>
      ` : nothing;

    const deleteButton = this.allowsDeletion ?
      html`
        <button id="delete-button">
          Delete
        </button>
      ` : nothing;

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
    const selectButton = this.selectMode === "none" ? nothing : html`
      <button id="select-button">
        Select
      </button>
    `;
    const closeButton = html`
      <button id="close-button">
        ${this.selectMode === "none" ? "Close" : "Cancel"}
      </button>
    `;
    return html`
      <div id="select-options">
        ${selectButton}
        ${closeButton}
      </div>
    `;
  }

  render() {
    const currentFolder = this.getEntryFromPath(this.currentFolderPath) as LibraryFolder;
    const entries = this.getEntryList(currentFolder, this.filter);

    return html`
      <div id="container">
        <div id="header">
          ${this.title}
        </div>
        ${this.htmlFolderTools(currentFolder)}
        ${this.htmlItemGrid(entries)}
        ${this.htmlAssetTools(currentFolder)}
        ${this.htmlSelectOptions()}
        <div>
          <button @click=${() => { console.log(JSON.stringify(this.rootFolder, undefined, 2)); }}>
            Dump
          </button>
        </div>
      </div>
    `;
  }

  serializeState() {
  }

  deserializeState() {
  }

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

  async initStorage() {
    try {
      if (this.idbDatabaseName &&
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
      }
    } catch (error) {
      console.log(`failed to initialize storage:`, error);
    }
  }

  async saveToStorage() {
    try {
      if (this.idbDatabaseName &&
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
      if (this.idbDatabaseName &&
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
      setTimeout(() => this.saveToIDB(root), IDB_WRITE_PERIOD_MS);
      return;
    }
    this.isSavingToIDB = true;
    await serialize(root, this.getIDBLocation());
    await new Promise(res => setTimeout(res, IDB_WRITE_PERIOD_MS));
    this.isSavingToIDB = false;
  }

  async loadFromIDB() {
    this.rootFolder = await deserialize(this.getIDBLocation(), "object");
    this.currentFolderPath = [this.rootFolder.name];
  }

  connectedCallback() {
    super.connectedCallback();
    this.initIDBStore().then(async () => {
      await this.loadFromIDB();
    }).catch(error => {
      console.log(`failed to load from IDB:`, error);
      this.rootFolder = {
        name: "root",
        tags: [],
        lastModifiedTimeMs: -1,
        isFolder: true,
        entries: {},
      };
      this.currentFolderPath = [this.rootFolder.name];
    });
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

function formatTime(timestampMs: number | null | undefined) {
  if (timestampMs == null || timestampMs <= 0) {
    return "unknown";
  }
  return (new Date(timestampMs)).toLocaleString();
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
  }
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
  return pruneObject(obj, key => key !== "dataUrl");
}

function getStorageKeyForEntryPath(path: string[]) {
  return path
    .map(name => name.replaceAll("\n", ""))
    .join("\n");
}



