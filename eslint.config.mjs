import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    "infrastructure/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Accessibility rules the college actually needs enforced: a clickable
      // row a keyboard cannot reach, or a control with no name, is invisible
      // to a screen reader no matter how it looks.
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      // The rule only knows native tags unless told otherwise, so every
      // wrapper that renders one has to be named or a correctly nested control
      // reads as an orphaned label.
      "jsx-a11y/label-has-associated-control": [
        "warn",
        {
          controlComponents: [
            "Input",
            "Select",
            "SelectTrigger",
            "Textarea",
            "Checkbox",
            "Switch",
            "RadioGroup",
          ],
        },
      ],
      // depth 3, not the default 2: the label text sits inside a span inside
      // the label, which is one level further than the rule looks by default.
      "jsx-a11y/control-has-associated-label": ["warn", { depth: 3 }],
      // A leading underscore is how this codebase says "bound deliberately and
      // not used" — destructuring a field out of an object to drop it is the
      // common case, and there is no other way to express it.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Last, so it wins: a later block overrides an earlier one in flat config.
  //
  // The vendored primitives are shadcn's own wrappers. Label forwards its props
  // to whatever consumes it, so it can never name a control itself, and the
  // interaction primitives compose handlers the rules cannot follow. Holding
  // upstream's files to our rules would only mean patching them on every
  // shadcn update.
  {
    files: ["src/components/ui/**"],
    rules: {
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/control-has-associated-label": "off",
    },
  },
]);

export default eslintConfig;
