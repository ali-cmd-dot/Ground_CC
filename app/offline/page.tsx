export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <div className="h-24 w-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 13a1 1 0 100-2 1 1 0 000 2zm0 0v4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">No Internet Connection</h1>
        <p className="text-gray-500 mb-6">
          Cautio needs internet to sync data.<br />
          Previously loaded pages are still available.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
