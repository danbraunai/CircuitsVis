import { ComponentStory, ComponentMeta } from "@storybook/react";
import React from "react";
import { mockActivations, mockTokens } from "./mocks/samples";
import { Samples } from "./Samples";

export default {
  component: Samples
} as ComponentMeta<typeof Samples>;

const Template: ComponentStory<typeof Samples> = (args) => (
  <Samples {...args} />
);

export const SmallModelExample = Template.bind({});
SmallModelExample.args = {
  tokens: mockTokens,
  activations: mockActivations
};
