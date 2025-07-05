import { SurveyTextWorker } from "../src/textWorker";

function createTextWorker(json: any): SurveyTextWorker {
  return new SurveyTextWorker(JSON.stringify(json, null, 3));
}

test("SurveyTextWorker, incorrect property name pos", () => {
  const textWorker = createTextWorker({
    elements: [
      {
        type: "text", name: "q1"
      },
      {
        type: "text",
        incorrectProp: "abc",
        name: "q2"
      },
      {
        type: "text", name: "q3"
      }
    ]
  });
  expect(textWorker.errors).toHaveLength(1);
  const error = textWorker.errors[0];
  const propNamePos = 126;
  expect(error.at).toBe(propNamePos);
  expect(textWorker.text.substring(propNamePos, propNamePos + 5)).toBe("incor");
  expect(error.rowAt).toBe(8);
  expect(error.columnAt).toBe(10);
  expect(error.isFixable).toBeFalsy();
});
test("SurveyTextWorker, show duplication name errors", () => {
  const textWorker = createTextWorker({
    pages: [{
      name: "page1",
      elements: [
        {
          type: "text", name: "q1"
        },
        {
          type: "text",
          name: "page1"
        },
        {
          type: "text", "name": "q1"
        }
      ] }
    ]
  });
  expect(textWorker.errors).toHaveLength(2);
  const error1 = textWorker.errors[0];
  const propNamePos1 = 221;
  expect(error1.at).toBe(propNamePos1);
  expect(textWorker.text.substring(propNamePos1, propNamePos1 + 7)).toBe("\"name\":");
  expect(error1.rowAt).toBe(11);
  expect(error1.columnAt).toBe(15);
  const error2 = textWorker.errors[1];
  const propNamePos2 = 312;
  expect(error2.at).toBe(propNamePos2);
  expect(textWorker.text.substring(propNamePos2, propNamePos2 + 7)).toBe("\"name\":");
  expect(error2.rowAt).toBe(15);
  expect(error2.columnAt).toBe(15);

  expect(error2.isFixable).toBeTruthy();
  const newJson2 = JSON.parse(error2.fixError(textWorker.text));
  expect(newJson2.pages[0].elements[2]).toEqual({
    type: "text",
    name: "question1"
  });
  expect(error1.isFixable).toBeTruthy();
  const newJson1 = JSON.parse(error1.fixError(textWorker.text));
  expect(newJson1.pages[0].elements[1]).toEqual({
    type: "text",
    name: "question1"
  });
});
test("SurveyTextWorker, required properties", () => {
  const textWorker = createTextWorker({
    pages: [{
      name: "page1",
      elements: [
        {
          type: "text"
        }
      ] }
    ]
  });
  expect(textWorker.errors).toHaveLength(1);
  const error = textWorker.errors[0];
  const propNamePos = 85;
  expect(error.at).toBe(propNamePos);
  expect(error.isFixable).toBeTruthy();
  const oldLines = textWorker.text.split("\n");
  textWorker.text = error.fixError(textWorker.text);
  const newJson = JSON.parse(textWorker.text);
  expect(newJson.pages[0].elements[0]).toEqual({
    type: "text",
    name: "question1"
  });
  const lines = textWorker.text.split("\n");
  expect(lines.length).toBe(oldLines.length + 1);
  const indent1 = lines[5].split(" ").length - 1;
  const indent2 = lines[6].split(" ").length - 1;
  expect(indent2).toBe(indent1 + 3);
});

// Tests for unknown properties warning feature
test("SurveyTextWorker, unknown properties as errors (default behavior)", () => {
  // Import settings locally to avoid affecting other tests
  const { settings } = require("../src/creator-settings");
  const originalSetting = settings.jsonEditor.allowUnknownProperties;
  
  try {
    // Ensure default behavior
    settings.jsonEditor.allowUnknownProperties = false;
    
    const textWorker = createTextWorker({
      elements: [
        {
          type: "text", 
          name: "q1",
          loincCode: "8310-5",
          "x-tooltip": "Use a thermometer"
        }
      ]
    });
    
    expect(textWorker.errors).toHaveLength(2); // Two unknown properties
    expect(textWorker.actualErrors).toHaveLength(2); // All should be errors
    expect(textWorker.warnings).toHaveLength(0); // No warnings
    expect(textWorker.isJsonHasErrors).toBe(true); // Should have errors
    
    // Check that both errors are marked as errors
    textWorker.errors.forEach(error => {
      expect(error.severity).toBe("error");
      expect(error.getErrorType()).toBe("unknownproperty");
    });
  } finally {
    // Restore original setting
    settings.jsonEditor.allowUnknownProperties = originalSetting;
  }
});

test("SurveyTextWorker, unknown properties as warnings", () => {
  const { settings } = require("../src/creator-settings");
  const originalSetting = settings.jsonEditor.allowUnknownProperties;
  
  try {
    // Enable warnings for unknown properties
    settings.jsonEditor.allowUnknownProperties = true;
    
    const textWorker = createTextWorker({
      elements: [
        {
          type: "text", 
          name: "q1",
          loincCode: "8310-5",
          "x-tooltip": "Use a thermometer"
        }
      ]
    });
    
    expect(textWorker.errors).toHaveLength(2); // Two unknown properties in total
    expect(textWorker.actualErrors).toHaveLength(0); // No actual errors
    expect(textWorker.warnings).toHaveLength(2); // Both should be warnings
    expect(textWorker.isJsonHasErrors).toBe(false); // Should not have errors
    expect(textWorker.isJsonCorrect).toBe(true); // JSON should be correct
    
    // Check that both are marked as warnings
    textWorker.errors.forEach(error => {
      expect(error.severity).toBe("warning");
      expect(error.getErrorType()).toBe("unknownproperty");
    });
  } finally {
    // Restore original setting
    settings.jsonEditor.allowUnknownProperties = originalSetting;
  }
});

test("SurveyTextWorker, mixed errors and warnings", () => {
  const { settings } = require("../src/creator-settings");
  const originalSetting = settings.jsonEditor.allowUnknownProperties;
  
  try {
    // Enable warnings for unknown properties
    settings.jsonEditor.allowUnknownProperties = true;
    
    const textWorker = createTextWorker({
      elements: [
        {
          type: "text",
          // Missing required name property (should be error)
          loincCode: "8310-5" // Unknown property (should be warning)
        }
      ]
    });
    
    expect(textWorker.errors).toHaveLength(2); // One error + one warning
    expect(textWorker.actualErrors).toHaveLength(1); // One actual error (missing name)
    expect(textWorker.warnings).toHaveLength(1); // One warning (unknown property)
    expect(textWorker.isJsonHasErrors).toBe(true); // Should have errors due to missing name
    
    // Check error types
    const actualError = textWorker.actualErrors[0];
    const warning = textWorker.warnings[0];
    
    expect(actualError.severity).toBe("error");
    expect(actualError.getErrorType()).toBe("requiredproperty");
    
    expect(warning.severity).toBe("warning");
    expect(warning.getErrorType()).toBe("unknownproperty");
  } finally {
    // Restore original setting
    settings.jsonEditor.allowUnknownProperties = originalSetting;
  }
});
