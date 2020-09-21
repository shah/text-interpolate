// deno-lint-ignore-file no-explicit-any
export interface InterpolationOptions {
  bracketPrefixes?: string[];
  openBracket: string;
  closeBracket: string;
}

export interface InterpolationExprOptions extends InterpolationOptions {
  pathDelims: string[];
}

export interface InterpolationSupplier {
  (replace: string, bracketPrefix?: string): string;
}

export interface InterpolatePropFetcherParams {
  readonly options: InterpolationOptions;
  readonly findExpr: string;
  readonly bracketPrefix?: string;
  readonly lookInObj: any;
  readonly level: number;
  readonly parent?: any;
  readonly parentDelim?: string;
  readonly remaining?: string;
}

export interface InterpolatePropFetcherResult {
  readonly params: InterpolatePropFetcherParams;
  readonly foundExpr: boolean;
  readonly foundObj: any;
}

export interface InterpolatePropFetcher {
  (params: InterpolatePropFetcherParams): InterpolatePropFetcherResult;
}

export interface InterpolateProperty {
  (params: InterpolatePropFetcherResult): string;
}

export interface InterpolatePropertyForPrefix {
  readonly prefixedBracket: boolean;
  readonly bracketPrefixes?: [string];
  readonly handler: InterpolateProperty;
}

export function defaultPropFetcher(
  params: InterpolatePropFetcherParams,
): InterpolatePropFetcherResult {
  return {
    params: params,
    foundExpr: params.findExpr in params.lookInObj,
    foundObj: params.lookInObj[params.findExpr],
  };
}

export function interpolationPropSupplier(
  // deno-lint-ignore ban-types
  lookInObject: object | object[],
  options: InterpolationExprOptions,
  fetcher: InterpolatePropFetcher,
  foundHandler: InterpolateProperty | InterpolatePropertyForPrefix[],
  notFoundHandler?: InterpolationSupplier,
): InterpolationSupplier {
  return (replace: string, bracketPrefix?: string): string => {
    const inObjs = Array.isArray(lookInObject) ? lookInObject : [lookInObject];
    for (const obj of inObjs) {
      const fetched = fetchFromObject(
        options,
        fetcher,
        obj,
        replace,
        bracketPrefix,
      );
      if (fetched.foundExpr) {
        if (Array.isArray(foundHandler)) {
          for (const ipfp of foundHandler) {
            if (
              (ipfp.prefixedBracket === false &&
                typeof bracketPrefix === "undefined") ||
              (ipfp.prefixedBracket &&
                ipfp.bracketPrefixes?.filter((bp) => bp == bracketPrefix))
            ) {
              return ipfp.handler(fetched);
            }
          }
        } else {
          return foundHandler(fetched);
        }
      }
    }
    return notFoundHandler
      ? notFoundHandler(replace, bracketPrefix)
      : `${
        bracketPrefix ? bracketPrefix : ""
      }${options.openBracket}${replace}${options.closeBracket}`;
  };
}

function fetchFromObject(
  options: InterpolationExprOptions,
  fetcher: InterpolatePropFetcher,
  lookInObj: any,
  findExpr: string,
  bracketPrefix?: string,
  level = 0,
  parent?: any,
  parentDelim?: string,
): InterpolatePropFetcherResult {
  const params = {
    findExpr,
    bracketPrefix,
    lookInObj,
    options,
    level,
    parent,
    parentDelim,
  };
  if (typeof lookInObj === "undefined") {
    return { params: params, foundExpr: false, foundObj: undefined };
  }

  let pathDelimIdx = -1;
  let matchedDelim = undefined;
  for (const delim of options.pathDelims) {
    pathDelimIdx = findExpr.indexOf(delim);
    if (pathDelimIdx > -1) {
      matchedDelim = delim;
      break;
    }
  }
  if (matchedDelim && pathDelimIdx > -1) {
    const newExpr = findExpr.substring(0, pathDelimIdx);
    const remaining = findExpr.substr(pathDelimIdx + matchedDelim.length);
    const fetched = fetcher({
      ...params,
      findExpr: newExpr,
    });
    if (!fetched) {
      return {
        params: params,
        foundExpr: false,
        foundObj: undefined,
      };
    }
    return fetchFromObject(
      options,
      fetcher,
      fetched.foundObj,
      remaining,
      bracketPrefix,
      level + 1,
      parent,
      matchedDelim,
    );
  }
  return fetcher(params);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function interpolate(
  template: string,
  replsSupplier: InterpolationSupplier,
  options: InterpolationOptions,
): string {
  const tmplLen = template.length;
  const out = [];
  const acc = [];
  const capture = [];
  let prefix = undefined;
  let openned = false;
  let i = 0;
  while (i < tmplLen) {
    if (!openned) {
      acc.push(template[i]);
    } else {
      capture.push(template[i]);
    }

    if (!openned && acc.length > 1) {
      out.push(acc.shift());
    }

    const j = acc.join("");
    if (!openned && j === options.openBracket) {
      openned = true;
      acc.length = 0;
      if (i > 1 && options.bracketPrefixes) {
        for (const bp of options.bracketPrefixes) {
          if (template[i - 1] === bp) {
            prefix = bp;
            out.length = out.length - 1;
          }
        }
      }
    } else if (
      openned &&
      capture
          .slice(
            capture.length - 1,
            capture.length,
          )
          .join("") === options.closeBracket
    ) {
      openned = false;
      const toRender = capture
        .slice(0, capture.length - 1)
        .join("")
        .trim();
      out.push(replsSupplier(toRender, prefix));
      prefix = undefined;
      capture.length = 0;
    }
    i++;
  }
  if (acc.length !== 0) {
    out.push(acc.join(""));
  }
  return out.join("");
}
