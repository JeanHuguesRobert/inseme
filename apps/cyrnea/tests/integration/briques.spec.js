import { test, expect } from "@playwright/test";
import registerAllBriqueTests from "./gen-briques-tests.js";

test.describe("Decentralized Brique Tests", () => {
  registerAllBriqueTests(test, expect);
});
