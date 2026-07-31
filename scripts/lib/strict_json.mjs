const JSON_WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const MAX_DEPTH = 100;

export function parseStrictJson(input, label = 'JSON artifact') {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let text;
  try {
    text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  } catch {
    throw new Error(`${label} must be valid UTF-8.`);
  }
  if (text.charCodeAt(0) === 0xfeff) {
    throw new Error(`${label} must not contain a UTF-8 BOM.`);
  }

  let index = 0;

  function fail(message) {
    throw new Error(`${label} ${message} at byte offset ${index}.`);
  }

  function skipWhitespace() {
    while (index < text.length && JSON_WHITESPACE.has(text[index])) {
      index += 1;
    }
  }

  function parseValue(depth) {
    if (depth > MAX_DEPTH) {
      fail(`exceeds the maximum nesting depth of ${MAX_DEPTH}`);
    }
    skipWhitespace();
    const token = text[index];
    if (token === '{') return parseObject(depth + 1);
    if (token === '[') return parseArray(depth + 1);
    if (token === '"') return parseString();
    if (token === 't') return parseLiteral('true', true);
    if (token === 'f') return parseLiteral('false', false);
    if (token === 'n') return parseLiteral('null', null);
    if (token === '-' || (token >= '0' && token <= '9')) {
      return parseNumber();
    }
    fail('contains an unexpected token');
  }

  function parseObject(depth) {
    const value = {};
    const keys = new Set();
    index += 1;
    skipWhitespace();
    if (text[index] === '}') {
      index += 1;
      return value;
    }
    while (index < text.length) {
      skipWhitespace();
      if (text[index] !== '"') {
        fail('object key must be a JSON string');
      }
      const key = parseString();
      if (keys.has(key)) {
        fail(`contains duplicate object key ${JSON.stringify(key)}`);
      }
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ':') {
        fail('object key must be followed by a colon');
      }
      index += 1;
      Object.defineProperty(value, key, {
        configurable: true,
        enumerable: true,
        value: parseValue(depth),
        writable: true,
      });
      skipWhitespace();
      if (text[index] === '}') {
        index += 1;
        return value;
      }
      if (text[index] !== ',') {
        fail('object entry must be followed by a comma or closing brace');
      }
      index += 1;
    }
    fail('contains an unterminated object');
  }

  function parseArray(depth) {
    const value = [];
    index += 1;
    skipWhitespace();
    if (text[index] === ']') {
      index += 1;
      return value;
    }
    while (index < text.length) {
      value.push(parseValue(depth));
      skipWhitespace();
      if (text[index] === ']') {
        index += 1;
        return value;
      }
      if (text[index] !== ',') {
        fail('array entry must be followed by a comma or closing bracket');
      }
      index += 1;
    }
    fail('contains an unterminated array');
  }

  function parseString() {
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(text.slice(start, index));
        } catch {
          fail('contains an invalid JSON string');
        }
      }
      if (character === '\\') {
        index += 1;
        if (index >= text.length) {
          fail('contains an unterminated escape');
        }
        if (text[index] === 'u') {
          const escape = text.slice(index + 1, index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(escape)) {
            fail('contains an invalid Unicode escape');
          }
          index += 5;
          continue;
        }
        if (!'"\\/bfnrt'.includes(text[index])) {
          fail('contains an invalid escape');
        }
      } else {
        if (character.charCodeAt(0) < 0x20) {
          fail('contains an unescaped control character');
        }
      }
      index += 1;
    }
    fail('contains an unterminated string');
  }

  function parseLiteral(literal, value) {
    if (text.slice(index, index + literal.length) !== literal) {
      fail(`contains an invalid ${literal} literal`);
    }
    index += literal.length;
    return value;
  }

  function parseNumber() {
    NUMBER_PATTERN.lastIndex = index;
    const match = NUMBER_PATTERN.exec(text);
    if (!match) {
      fail('contains an invalid number');
    }
    index = NUMBER_PATTERN.lastIndex;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) {
      fail('contains a non-finite number');
    }
    return value;
  }

  const value = parseValue(0);
  skipWhitespace();
  if (index !== text.length) {
    fail('contains trailing content');
  }
  return value;
}
