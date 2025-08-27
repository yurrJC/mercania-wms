export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900">Mercania WMS Test Page</h1>
      <p className="mt-4 text-gray-600">If you can see this, the Next.js server is working!</p>
      <div className="mt-8 p-4 bg-blue-100 rounded-lg">
        <h2 className="text-xl font-semibold text-blue-900">System Status</h2>
        <ul className="mt-2 space-y-1 text-blue-800">
          <li>✅ Next.js: Running</li>
          <li>✅ React: Working</li>
          <li>✅ Tailwind: Styling applied</li>
        </ul>
      </div>
      <div className="mt-4">
        <a 
          href="/" 
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
