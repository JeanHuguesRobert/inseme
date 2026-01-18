/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // Enforce CSS variable usage for colors
    "declaration-property-value-disallowed-list": {
      "/^(background|color|border|outline|box-shadow)$/": [
        /^#[0-9a-f]{3,8}$/i, // No hex colors
        /^rgb/i, // No rgb() or rgba()
        /^hsl/i, // No hsl() or hsla() (except in variables.css)
      ],
    },

    // Allow Tailwind directives
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["tailwind", "layer"],
      },
    ],

    // Enforce semantic ordering
    "order/properties-order": [
      "position",
      "top",
      "right",
      "bottom",
      "left",
      "z-index",
      "display",
      "flex-direction",
      "justify-content",
      "align-items",
      "gap",
      "width",
      "height",
      "padding",
      "margin",
      "background",
      "border",
      "color",
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "transition",
      "animation",
    ],

    // Allow empty sources (for @tailwind directives)
    "no-empty-source": null,
  },

  // Ignore node_modules, build output and the legacy folders
  ignoreFiles: [
    "node_modules/**",
    "dist/**",
    "build/**",
    "src/components/bob/broken-v1/**",
    "src/components/bob/legacy/**",
  ],
};
