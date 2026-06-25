import { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[60vh] flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h2 className="text-xl font-bold text-surface-800 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-surface-500 mb-4">
                            An unexpected error occurred. Please try again or contact support if the problem persists.
                        </p>
                        <div className="text-left bg-red-50 p-4 rounded-xl overflow-auto text-xs text-red-800 mb-6 font-mono whitespace-pre-wrap max-h-64">
                            {this.state.error?.toString()}
                            <br/><br/>
                            {this.state.error?.stack}
                        </div>
                        <button
                            onClick={this.handleRetry}
                            className="btn btn-primary"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
