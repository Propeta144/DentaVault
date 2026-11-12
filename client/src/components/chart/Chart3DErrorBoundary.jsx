import { Component } from 'react'

// Suspense ay pang-loading lang. Kapag pumalya ang lazy import o WebGL,
// dito lang sa chart ang error, hindi sa buong patient profile.
export default class Chart3DErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('3D chart could not load:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="font-medium text-red-700">The 3D chart could not load.</p>
        <p className="mt-1 text-sm text-red-700">Refresh the page to try again, or continue with the 2D chart.</p>
        <button type="button" onClick={this.props.onSwitchTo2D}
          className="mt-3 min-h-11 rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50">
          Use 2D chart
        </button>
      </div>
    )
  }
}
