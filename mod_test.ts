import * as ws from "https://raw.githubusercontent.com/shah/text-whitespace/v1.0.2/mod.ts";
import { assertEquals } from "https://deno.land/std@v0.62.0/testing/asserts.ts";
import * as interp from "./mod.ts";

Deno.test("Text interpolation with string supplier", () => {
  const goldenRenderSingleLine =
    `select col1, col2, col3# from table where col1 = 'Value with spaces' and %col2 = "Another set of spaces"`;
  const testTemplate = `
    select {a}, {b}, #{c}
      from {entity}
     where {a} = 'Value with spaces' 
       and %{b} = "Another set of spaces"`;

  const interpolationOptions: interp.InterpolationOptions = {
    bracketPrefixes: ["#", "%"],
    openBracket: "{",
    closeBracket: "}",
  };
  assertEquals(
    goldenRenderSingleLine,
    ws.singleLineTrim(
      interp.interpolate(
        testTemplate,
        (src: string, bracketPrefix?: string): string => {
          switch (src) {
            case "a":
              return "col1";
            case "b":
              return bracketPrefix ? bracketPrefix + "col2" : "col2";
            case "c":
              return "col3" + bracketPrefix;
            case "entity":
              return "table";
          }
          return "#ERROR#";
        },
        interpolationOptions,
      ),
    ),
  );
});

Deno.test("Text interpolation with object supplier", () => {
  const goldenRenderSingleLine =
    `select col1, col2, col3 from table where table.col1 = 'Value with spaces' and table.col2 = "Another set of spaces"`;
  const testTemplate = `
    select {entity:a}, {entity:b}, {entity::c}
      from {entity}
     where {entity.a} = 'Value with spaces' 
       and {entity.b} = "Another set of spaces"`;
  const exprSupplierObj = {
    entity: {
      isEntity: true,
      tableName: "table",
      attrs: [
        { isAttr: true, attrName: "a", colName: "col1" },
        { isAttr: true, attrName: "b", colName: "col2" },
        { isAttr: true, attrName: "c", colName: "col3" },
      ],
    },
  };
  const fetcher = (
    params: interp.InterpolatePropFetcherParams,
  ): interp.InterpolatePropFetcherResult => {
    if (params.level == 0 && params.findExpr == "entity") {
      return {
        params: params,
        foundExpr: true,
        foundObj: params.lookInObj.entity,
      };
    }
    if (params.lookInObj.attrs) {
      for (const a of params.lookInObj.attrs) {
        if (params.findExpr == a.attrName) {
          return { params: params, foundExpr: true, foundObj: a };
        }
      }
    }
    return { params: params, foundExpr: false, foundObj: undefined };
  };

  const interpolationOptions: interp.InterpolationExprOptions = {
    openBracket: "{",
    pathDelims: [".", "::", ":"],
    closeBracket: "}",
  };
  assertEquals(
    goldenRenderSingleLine,
    ws.singleLineTrim(
      interp.interpolate(
        testTemplate,
        interp.interpolationPropSupplier(
          exprSupplierObj,
          interpolationOptions,
          fetcher,
          (
            { params, foundExpr: found, foundObj }:
              interp.InterpolatePropFetcherResult,
          ): string => {
            if (found) {
              if ("isEntity" in foundObj) return foundObj.tableName;
              if ("isAttr" in foundObj) {
                return params.parentDelim == "."
                  ? `table.${foundObj.colName}`
                  : foundObj.colName;
              }
            }
            return `${params.findExpr}?`;
          },
        ),
        interpolationOptions,
      ),
    ),
  );
});
