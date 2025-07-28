import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { fn } from 'storybook/test';

import { html } from 'lit';
import { LayoutElement } from '../layout-manager/layout-element';
import { ref } from 'lit/directives/ref.js';
import { AbsoluteLayoutInterval, DynamicLayoutInterval, DynamicLayoutLength, LayoutInterval, RelativeLayoutLength } from '../layout-manager/layout-region';

type StoryArgs = {
  x: (context?: HTMLDivElement) => LayoutInterval;
  y: (context?: HTMLDivElement) => LayoutInterval;
};

const meta = {
  title: 'LayoutManager/LayoutElement',
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  render: (args: StoryArgs) => {
    LayoutElement.register("layout-element");
    const { x, y } = args;
    let layoutElement: LayoutElement | undefined = undefined;
    let context: HTMLDivElement | undefined = undefined;
    const tryUpdateElement = () => {
      if (!context || !layoutElement) {
        return;
      }
      layoutElement.x = x(context);
      layoutElement.y = y(context);
    }
    const onContextRendered = (c?: Element) => {
      if (!c) {
        return;
      }
      context = c as HTMLDivElement;
      tryUpdateElement();
    }
    const onLayoutElementRendered = (le?: Element) => {
      if (!le) {
        return;
      }
      layoutElement = le as LayoutElement;
      tryUpdateElement();
    }
    return html`
      <div id="layout-context"
        style="position: relative; width: 400px; height: 400px; background-color: #ffefef;"
        ${ref(onContextRendered)}
      >
        <layout-element id="layout-element"
          style="background-color: blue; color: white;"
          ${ref(onLayoutElementRendered)}
        >
          ABC
        </layout-element>
      </div>
    `;
  },
  args: {
  },
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<StoryArgs>;

export const Absolute: Story = {
  args: {
    x: () => new AbsoluteLayoutInterval({ start: 100, length: 250 }),
    y: () => new AbsoluteLayoutInterval({ start: 250, end: 275 }),
  },
};

export const Relative: Story = {
  args: {
    x: (context?: HTMLDivElement) => new DynamicLayoutInterval({
      start: new RelativeLayoutLength(0.1, new DynamicLayoutLength(() => context?.offsetWidth ?? 0)),
      length: new RelativeLayoutLength(0.5, new DynamicLayoutLength(() => context?.offsetWidth ?? 0)),
    }),
    y: (context?: HTMLDivElement) => new DynamicLayoutInterval({
      length: new RelativeLayoutLength(0.8, new DynamicLayoutLength(() => context?.offsetHeight ?? 0)),
      end: new RelativeLayoutLength(0.95, new DynamicLayoutLength(() => context?.offsetHeight ?? 0)),
    }),
  },
}
