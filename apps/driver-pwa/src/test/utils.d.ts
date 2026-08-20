import { render, type RenderOptions } from '@testing-library/react';
declare function customRender(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>): ReturnType<typeof render>;
export * from '@testing-library/react';
export { customRender as render };
//# sourceMappingURL=utils.d.ts.map