import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCurrency, setDefaultCurrency } from "./format.ts";
import { LOCALE_TAGS } from "./i18n/locales.ts";

test("formatCurrency follows the configured default currency", () => {
  try {
    setDefaultCurrency("EUR");
    assert.match(formatCurrency(12.5), /€/);
    assert.doesNotMatch(formatCurrency(12.5), /₹/);
    setDefaultCurrency("not-a-code");
    assert.match(formatCurrency(12.5), /€/); // invalid codes are ignored
    assert.match(formatCurrency(12.5, "INR"), /₹/); // an explicit currency still wins
  } finally {
    setDefaultCurrency("INR");
  }
});

test("guest prices follow the selected language and the restaurant currency", () => {
  assert.match(formatCurrency(25, "BRL", LOCALE_TAGS.pt), /^R\$\s25,00$/);
  assert.equal(formatCurrency(25, "BRL", LOCALE_TAGS.en), "R$25.00");
  assert.match(formatCurrency(25, "EUR", LOCALE_TAGS.pt), /^€\s25,00$/);
  assert.match(formatCurrency(25, "EUR", LOCALE_TAGS.es), /^25,00\s€$/);
  assert.match(formatCurrency(25, "EUR", LOCALE_TAGS.fr), /^25,00\s€$/);
});
