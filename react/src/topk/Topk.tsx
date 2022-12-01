import {
  Rank,
  tensor,
  Tensor2D,
  Tensor3D,
  reverse,
  topk as tfTopk
} from "@tensorflow/tfjs";
import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-grid-system";
import { ColoredTokens } from "../tokens/ColoredTokens";
import { getTokenBackgroundColor } from "../utils/getTokenBackgroundColor";
import {
  rangeArrToString,
  rangeStringToArr
} from "../utils/rangeStrArrConversion";

/**
 * Create an html select with each option being a string representation of a
 * range of numbers that takes the form "start-end", where start is the first
 * number in the range and end is the last number in the range. E.g. if
 * largestNumber=4, smallestNumber=0, and numValsInRange=2, then the ranges array
 * will be ["0-1", "2-3", "4"].
 * @param {number} smallestNumber - Smallest number in the range.
 * @param {number} largestNumber - Largest number included in the ranges.
 * @param {number[]} currentRangeArr - Current range selected represented as an array of numbers.
 * @param {function(number[]): void} setCurrentValue - Function for setting
 * the selected range.
 * @param {number} numValsInRange - The max number of values in each range.
 * @param {number} id - The id of the select.
 * @returns Select element.
 */
export function RangeSelector({
  smallestNumber = 0,
  largestNumber,
  currentRangeArr,
  setCurrentValue,
  numValsInRange,
  id
}: {
  smallestNumber?: number;
  largestNumber: number;
  currentRangeArr: number[];
  setCurrentValue: (rangeArr: number[]) => void;
  numValsInRange: number;
  id: string;
}): JSX.Element {
  // Convert the current range to a string.
  const currentRange: string = rangeArrToString(currentRangeArr);

  // Create an array of ranges to display in the select.
  const ranges: string[] = [];
  for (let i = smallestNumber; i <= largestNumber; i += numValsInRange) {
    const start = i;
    const end = Math.min(i + numValsInRange - 1, largestNumber);
    if (start === end) {
      ranges.push(`${start}`);
    } else {
      ranges.push(`${start}-${end}`);
    }
  }

  return (
    <select
      value={currentRange}
      onChange={(event) =>
        setCurrentValue(rangeStringToArr(event.target.value))
      }
      id={id}
    >
      {ranges.map((range) => (
        <option key={range}>{range}</option>
      ))}
    </select>
  );
}

/**
 * Create an html select with each option corresponding to a single number in a
 * range of numbers.
 * @param {number} smallestNumber - Smallest number in the range.
 * @param {number} largestNumber - Largest number included in the ranges.
 * @param {number} currentValue - Current value selected.
 * @param {function(number): void} setCurrentValue - Function for setting
 * the selected value.
 * @param {number} id - The id of the select.
 * @returns Select element.
 */
export function NumberSelector({
  smallestNumber = 0,
  largestNumber,
  currentValue,
  setCurrentValue,
  id
}: {
  smallestNumber?: number;
  largestNumber: number;
  currentValue: number;
  setCurrentValue: (num: number) => void;
  id: string;
}) {
  // Initialize an array of numbers smallestNumber-largestNumber
  const options = [...Array(largestNumber - smallestNumber + 1).keys()].map(
    (i) => i + smallestNumber
  );

  return (
    <select
      value={currentValue}
      onChange={(event) => setCurrentValue(Number(event.target.value))}
      id={id}
    >
      {options.map((value) => (
        <option key={value}>{value}</option>
      ))}
    </select>
  );
}

/**
 * Get the selected activations
 *
 * @param {Tensor3D} activations - Activations for the selected sample [ tokens x layers x neurons ]
 * @param {number} layerNumber - Selected layer number
 * @param {number} neuronStartNumber - First selected neuron number
 * @param {number} neuronEndNumber - Last selected neuron number
 * @returns Selected activations [ neurons x tokens ]. This form is required for
 * topk which can only calculate the topk over the final dimension
 */
export function getSelectedActivations(
  activations: Tensor3D,
  layerNumber: number,
  neuronStartNumber: number,
  neuronEndNumber: number
): Tensor2D {
  const currentActivations: Tensor2D = activations
    .slice(
      [0, layerNumber, neuronStartNumber],
      [-1, 1, neuronEndNumber - neuronStartNumber + 1]
    )
    .squeeze<Tensor2D>([1]) // squeeze out the layer dimension
    .transpose(); // transpose so that the tokens are the last dimension (needed for tfjs's topk)
  return currentActivations; // [neurons x tokens]
}

function tdStyle(value: number, maxTokenLength: number): React.CSSProperties {
  // Styling for each cell in the table
  // The background color is determined by the activation value
  const backgroundColor = getTokenBackgroundColor(value, 0, 1).toRgbString();
  return {
    backgroundColor,
    border: "1px solid black",
    width: `${maxTokenLength + 2}ch`
  };
}

/**
 * Create a table with the topk and bottomk tokens for each neuron in the selected range.
 * @param {number[][]} bottomkActivations - Bottomk activations
 * @param {string[][]} topktokens - Topk tokens for the selected sample and neuron numbers [ tokens x neurons ]
 * @param {string[][]} bottomktokens - Bottomk tokens
 * @param {number} maxTokenLength - The number of chars in the longest token
 * @param {numberp[]} neuronNumbers - The neuron numbers we wish to display
 * (each will have its own column)
 * @returns {JSX.Element} A react-grid-system Container element containing the table.
 */
export function TopBottomKTable({
  topkActivations,
  bottomkActivations,
  topkTokens,
  bottomkTokens,
  maxTokenLength,
  neuronNumbers
}: {
  /** Topk activations for the selected sample and neuron numbers [ tokens x neurons ] */
  topkActivations: number[][];
  bottomkActivations: number[][]; // [tokens x neurons]
  topkTokens: string[][]; // [tokens x neurons]
  bottomkTokens: string[][]; // [tokens x neurons]
  maxTokenLength: number;
  neuronNumbers: number[];
}) {
  // Create a table of size [topkActivations.shape with each column
  // corresponding to the topk activations coloured by their activation value
  // for a specific neuron

  // TODO; Try using HTML Table

  return (
    <Container fluid>
      {/* The first header row just shows the current neuron idx */}
      <Row>
        {neuronNumbers.map((neuronNumber) => (
          <Col key={neuronNumber} style={{ textAlign: "center" }}>
            {neuronNumber}
          </Col>
        ))}
      </Row>
      {topkActivations.map((activations, tokenIdx) => (
        <Row key={tokenIdx}>
          {/* Show the coloured token for each activation */}
          {activations.map((activation, neuronIdx) => (
            /** TODO; move this + style to react component */
            /** TODO: split to own component */
            <Col key={neuronIdx} style={tdStyle(activation, maxTokenLength)}>
              <ColoredTokens
                tokens={[topkTokens[tokenIdx][neuronIdx]]}
                values={[activation]}
                maxValue={1}
                minValue={0}
                paddingBottom={0}
                border={false}
              />
            </Col>
          ))}
        </Row>
      ))}
      <Row>
        {/* Add an ellipse for each column */}
        {Array(topkActivations[0].length)
          .fill(0)
          .map((_, idx) => (
            <Col key={idx}>
              <div style={{ textAlign: "center" }}>...</div>
            </Col>
          ))}
      </Row>
      {bottomkActivations.map((activations, tokenIdx) => (
        <Row key={tokenIdx}>
          {/* Show the coloured token for each activation */}
          {activations.map((activation, neuronIdx) => (
            <Col key={neuronIdx} style={tdStyle(activation, maxTokenLength)}>
              <ColoredTokens
                tokens={[bottomkTokens[tokenIdx][neuronIdx]]}
                values={[activation]}
                maxValue={1}
                minValue={0}
                paddingBottom={0}
                border={false}
              />
            </Col>
          ))}
        </Row>
      ))}
    </Container>
  );
}

/**
 * Show the topk and bottomk tokens for each neuron/directions.
 *
 * Includes drop-downs for k, layer and neuron numbers, and the number of
 * columns to show (representing the neurons or directions).
 */
export function Topk({
  tokens,
  activations,
  firstDimensionName = "Sample",
  secondDimensionName = "Layer",
  thirdDimensionName = "Neuron" // Note that we simply use neuron as variable names throughout this file
}: TopkProps): JSX.Element {
  const activationsTensors = activations.map((sampleActivations) => {
    return tensor<Rank.R3>(sampleActivations);
  });
  // Get number of layers/neurons (Assumes all samples have the same number of layers/neurons)
  const numberOfLayers = activationsTensors[0].shape[1];
  const numberOfNeurons = activationsTensors[0].shape[2];
  const numberOfSamples = activationsTensors.length;

  /** TODO: reqct-hook-form <- investigate */
  const [sampleNumber, setSampleNumber] = useState<number>(0);
  const [layerNumber, setLayerNumber] = useState<number>(0);
  const [colsToShow, setColsToShow] = useState<number>(5);
  const [k, setK] = useState<number>(5);
  const [neuronNumbers, setNeuronNumbers] = useState<number[]>(
    numberOfSamples > 1 ? [...Array(colsToShow).keys()] : [0]
  );

  useEffect(() => {
    // When the user changes the colsToShow, update the neuronNumbers
    setNeuronNumbers(numberOfSamples > 1 ? [...Array(colsToShow).keys()] : [0]);
  }, [colsToShow, numberOfSamples]);

  const currentTokens: string[] = tokens[sampleNumber];
  // Get the relevant activations for the selected samples, layer, and neuron.
  const currentActivations: Tensor2D = getSelectedActivations(
    activationsTensors[sampleNumber],
    layerNumber,
    neuronNumbers[0],
    neuronNumbers[neuronNumbers.length - 1]
  ); // [neurons x tokens]

  const { values: topkValsRaw, indices: topkIdxsRaw } = tfTopk(
    currentActivations,
    k,
    true
  );
  const { values: bottomkValsRaw, indices: bottomkIdxsRaw } = tfTopk(
    currentActivations.mul(-1),
    k,
    true
  );

  /** TODO: Split "business logic" into its own function & add unit tests */
  // The topk and bottomk values, indices and tokens will be tensors of shape
  // [tokens x neurons]. This form makes it easier to display the table
  const topkVals: number[][] = topkValsRaw
    .transpose()
    .arraySync() as number[][];
  const topkIdxs: number[][] = topkIdxsRaw
    .transpose()
    .arraySync() as number[][];
  // Bottom vals are ordered from highest to lowest activations (just like top vals)
  const bottomkVals: number[][] = reverse(bottomkValsRaw.mul(-1), -1)
    .transpose()
    .arraySync() as number[][];
  const bottomkIdxs: number[][] = reverse(bottomkIdxsRaw, -1)
    .transpose()
    .arraySync() as number[][];

  const topkTokens: string[][] = topkIdxs.map((outerArr) =>
    outerArr.map((token_idx) => currentTokens[token_idx])
  );
  const bottomkTokens: string[][] = bottomkIdxs.map((outerArr) =>
    outerArr.map((token_idx) => currentTokens[token_idx])
  );

  // Calculate the max token length for use in the table column width
  const maxTokenLength: number = Math.max(
    ...currentTokens.map((token) => token.length)
  );

  return (
    <Container fluid>
      <Row>
        <Col>
          <Row style={{ paddingTop: 5, paddingBottom: 5 }}>
            <Col>
              <label htmlFor="sample-selector" style={{ marginRight: 15 }}>
                {firstDimensionName}:
              </label>
              <NumberSelector
                id="sample-selector"
                smallestNumber={0}
                largestNumber={numberOfSamples - 1}
                currentValue={sampleNumber}
                setCurrentValue={setSampleNumber}
              />
            </Col>
          </Row>
          <Row style={{ paddingTop: 5, paddingBottom: 5 }}>
            <Col>
              <label htmlFor="layer-selector" style={{ marginRight: 15 }}>
                {secondDimensionName}:
              </label>
              <NumberSelector
                id="layer-selector"
                largestNumber={numberOfLayers - 1}
                currentValue={layerNumber}
                setCurrentValue={setLayerNumber}
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <label htmlFor="neuron-selector" style={{ marginRight: 15 }}>
                {thirdDimensionName}:
              </label>
              <RangeSelector
                id="neuron-selector"
                largestNumber={numberOfNeurons - 1}
                currentRangeArr={neuronNumbers}
                setCurrentValue={setNeuronNumbers}
                numValsInRange={colsToShow}
              />
            </Col>
          </Row>
        </Col>
        <Col>
          <Row>
            <Col>
              <label htmlFor="visibleCols-selector" style={{ marginRight: 15 }}>
                {thirdDimensionName}s to show:
              </label>
              <NumberSelector
                id="visible-cols-selector"
                smallestNumber={1}
                largestNumber={numberOfNeurons}
                currentValue={colsToShow}
                setCurrentValue={setColsToShow}
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <label htmlFor="k-selector" style={{ marginRight: 15 }}>
                k:
              </label>
              <NumberSelector
                id="k-selector"
                smallestNumber={1}
                largestNumber={20}
                currentValue={k}
                setCurrentValue={setK}
              />
            </Col>
          </Row>
        </Col>
      </Row>
      <Row style={{ marginTop: 15 }}>
        <TopBottomKTable
          topkActivations={topkVals}
          bottomkActivations={bottomkVals}
          topkTokens={topkTokens}
          bottomkTokens={bottomkTokens}
          maxTokenLength={maxTokenLength}
          neuronNumbers={neuronNumbers}
        />
      </Row>
    </Container>
  );
}

export interface TopkProps {
  /**
   * List of lists of tokens [ samples x tokens ]
   *
   * Each list must be the same length as the number of activations in the
   * corresponding activations list.
   */
  tokens: string[][];

  /**
   * Activations
   *
   * Should be a nested list of numbers of the form [ samples x tokens x layers x neurons ].
   */
  activations: number[][][][];

  /**
   * Name of the first dimension
   */
  firstDimensionName?: string;

  /**
   * Name of the second dimension
   */
  secondDimensionName?: string;

  /**
   * Name of the third dimension
   */
  thirdDimensionName?: string;
}
