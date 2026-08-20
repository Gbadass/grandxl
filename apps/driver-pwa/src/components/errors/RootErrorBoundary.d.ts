import { Component, type ReactNode, type ErrorInfo } from 'react';
interface Props {
    children: ReactNode;
}
interface State {
    hasError: boolean;
}
export declare class RootErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(): State;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    render(): ReactNode;
}
export {};
//# sourceMappingURL=RootErrorBoundary.d.ts.map