export type SortBy = 'name' | 'time'

export type UserCollectionProperties = {
  rootDir: string;
  allowsCreation: boolean;
  allowsDeletion: boolean;
  filter: string;
  sortBy: SortBy;
  sortAscending: boolean;
  numColumns: number;
  preview: (file: File) => HTMLElement;
};

export type UserCollectionEntryFileSource = {
  type: 'opfs';
  path: string[];
};

export type UserCollectionEntryIDBSource = {
  type: 'idb';
  dbName: string;
  storeName: string;
  keyPath: string;
  valuePath: string;
};

export class UserCollection extends HTMLElement {
  /**
   * The tag name that has been registered for this component.
   */
  static tagName: string = "";

  /**
   * @brief Registers {@link UserCollection} as a custom web component with tag
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
  static register(tagName: string = "user-collection"): string {
    if (!UserCollection.tagName) {
      customElements.define(tagName, UserCollection);
      UserCollection.tagName = tagName;
      return tagName;
    } else {
      return UserCollection.tagName;
    }
  }

  constructor() {
    super();

    const template = document.createElement("template");
    template.innerHTML = `
      <style>
        :host {
          all: inherit;
        }

        #container {
          position: relative;
          min-width: 80%;
          max-width: 100%;
          min-height: 80%;
          max-height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0;
        }

        #header {
          width: 100%;
          font-family: sans-serif;
          font-size: 1.2em;
          line-height: 2;
          margin: 0;
          background-color: var(--dialog-title-background-color, blue);
          color: var(--dialog-title-color, white);
        }

        #item-grid {
          display: grid;
        }
      </style>
      <div id="container" part="container">
        <div id="header" part="header">
          <slot></slot>
        </div>
        <div id="item-grid" part="item-grid">
        </div>
      </div>
    `;

    const root = this.attachShadow({ mode: "open" })
    root.append(template.content.cloneNode(true));

  }

  private db: any;

  connectedCallback() {
    this.connectToDb();
  }

  disconnectedCallback() {
  }

  connectToDb() {
  }
}

