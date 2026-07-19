export default {
  multipass: true,
  plugins: [
    "preset-default",
    {
      name: "removeAttrs",
      params: {
        attrs: "(fill|stroke)"
      }
    }
  ]
};
