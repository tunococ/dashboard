import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';
import { LayoutElement } from '../layout-manager/layout-element';
import { ref } from 'lit/directives/ref.js';
import { AbsoluteLayoutInterval, DynamicLayoutInterval, DynamicLayoutLength, LayoutInterval, RelativeLayoutLength } from '../layout-manager/layout-region';
import { AbsoluteLength, ConfiguredInterval, ConfiguredLayoutElement, ConfiguredRegion, LayoutContext } from '../layout-manager/layout-context';
import { LayoutManager } from '../layout-manager/layout-manager';

type StoryArgs = {
  elements: {
    region: ConfiguredRegion;
    color: string;
  }[];
};

function createElement(color: string) {
  const element = document.createElement(LayoutElement.register());
  element.style.backgroundColor = color;
  return element as LayoutElement;
}

const meta = {
  title: 'LayoutManager/LayoutManager',
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  loaders: async ({ args }) => {
    const configuredLayoutElements =
      args.elements.map(({ region, color }) => {
        return new ConfiguredLayoutElement(createElement(color), region);
      })
    return { elements: configuredLayoutElements };
  },
  render: (_args, { loaded }) => {
    const { elements } = loaded;
    let layoutManager: LayoutManager | undefined;
    const onInitialized = (lm?: LayoutManager) => {
      if (lm) {
        layoutManager = lm;
        for (const element of elements) {
          lm.addElement(element);
        }
      }
    }
    const onToggleMovable = (e: InputEvent) => {
      for (const element of elements) {
        element.element.movable = !!(e.target as HTMLInputElement).checked;
      }
      e.preventDefault();
      e.stopPropagation();
    }
    const onToggleResizable = (e: InputEvent) => {
      for (const element of elements) {
        element.element.resizable = !!(e.target as HTMLInputElement).checked;
      }
      e.preventDefault();
      e.stopPropagation();
    }
    const onToggleAspectRatio = (e: InputEvent) => {
      if (!layoutManager) {
        return;
      }
      for (const elementId of layoutManager.elementIds) {
        const elementData = layoutManager.elementData(elementId);

      }
    }
    return html`
      <layout-manager
        style="position: relative; display: block; width: 80dvw; height: 80dvh; background-color: #efffdf;"
        ${ref((e: any) => onInitialized(e))}
      >
        <div>
          <input type="checkbox" id="movable" name="movable"
            @change=${onToggleMovable}
          />
          <label for="movable">Movable</label>
        </div>
        <div>
          <input type="checkbox" id="resizable" name="resizable"
            @change=${onToggleResizable}
          />
          <label for="resizable">Resizable</label>
        </div>
      </layout-manager>
    `
  },
  async beforeEach() {
    LayoutManager.register("layout-manager");
    LayoutElement.register("layout-element");
  },
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<StoryArgs>;

export const Absolute: Story = {
  args: {
    elements: [
      {
        region:
          new ConfiguredRegion([
            new ConfiguredInterval({
              start: new AbsoluteLength(10),
              length: new AbsoluteLength(100),
            }),
            new ConfiguredInterval({
              start: new AbsoluteLength(50),
              end: new AbsoluteLength(80),
            }),
          ]),
        color: "#1010ff",
      }
    ]
  },
};

