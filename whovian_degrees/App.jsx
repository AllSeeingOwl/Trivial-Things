// import React, { useState } from 'react'; // Commented out for browser-side Babel standalone compatibility

// List of the 14 main actors who played Doctor Who
const doctorActors = [
    "William Hartnell", "Patrick Troughton", "Jon Pertwee", "Tom Baker",
    "Peter Davison", "Colin Baker", "Sylvester McCoy", "Paul McGann",
    "Christopher Eccleston", "David Tennant", "Matt Smith", "Peter Capaldi",
    "Jodie Whittaker", "Ncuti Gatwa"
];

// Main App component for the Whovian Degrees game
const App = () => {
    const [startActor, setStartActor] = React.useState(''); // State for the starting actor input
    const [targetDoctor, setTargetDoctor] = React.useState(''); // State for the selected target Doctor
    const [connectionPath, setConnectionPath] = React.useState(''); // State to display the found connection path
    const [loading, setLoading] = React.useState(false); // State for loading indicator
    const [message, setMessage] = React.useState(''); // State for general messages/errors

    /**
     * Handles the "Find Connection" form submission.
     * Calls the LLM to find a path between the start actor and the target Doctor.
     */
    const findConnection = async (e) => {
        if (e) e.preventDefault(); // Prevent default form submission behavior

        if (!startActor.trim() || !targetDoctor.trim()) {
            setMessage('Please enter a starting actor and select a target Doctor.');
            return;
        }

        setLoading(true); // Show loading indicator
        setConnectionPath(''); // Clear previous path
        setMessage(''); // Clear previous messages

        try {
            // Call the backend API instead of the external AI service directly
            const response = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startActor, targetDoctor })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (result.connectionPath) {
                setConnectionPath(result.connectionPath);
            } else {
                setMessage('Could not find a connection. Please try again or with different actors.');
            }
        } catch (error) {
            console.error('Error fetching connection:', error);
            setMessage(`An error occurred while trying to find the connection: ${error.message || 'Please try again.'}`);
        } finally {
            setLoading(false); // Hide loading indicator
        }
    };

    /**
     * Resets the game state.
     */
    const resetGame = () => {
        setStartActor('');
        setTargetDoctor('');
        setConnectionPath('');
        setMessage('');
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white font-inter p-4 sm:p-8 flex items-center justify-center">
            <div className="bg-gray-800 bg-opacity-70 backdrop-blur-md p-6 sm:p-10 rounded-xl shadow-2xl w-full max-w-3xl border border-purple-700">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-center mb-6 text-purple-300">
                    Whovian Degrees
                </h1>
                <p className="text-center text-purple-200 mb-8 max-w-prose mx-auto">
                    Discover the interconnectedness of actors! Find a path from any actor to one of the 14 main Doctors in six steps or fewer.
                </p>

                <form onSubmit={findConnection} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="startActor" className="block text-purple-200 text-sm font-medium mb-2">
                                Starting Actor:
                            </label>
                            <input
                                type="text"
                                id="startActor"
                                value={startActor}
                                onChange={(e) => setStartActor(e.target.value)}
                                disabled={loading}
                                placeholder="e.g., Tom Hanks"
                                className="w-full p-3 rounded-md bg-gray-700 border border-purple-600 focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none text-white placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label htmlFor="targetDoctor" className="block text-purple-200 text-sm font-medium mb-2">
                                Target Doctor:
                            </label>
                            <select
                                id="targetDoctor"
                                value={targetDoctor}
                                onChange={(e) => setTargetDoctor(e.target.value)}
                                disabled={loading}
                                className="w-full p-3 rounded-md bg-gray-700 border border-purple-600 focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="" disabled>Select a Doctor</option>
                                {doctorActors.map((doctor) => (
                                    <option key={doctor} value={doctor}>
                                        {doctor}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
                        <button
                            type="submit"
                            disabled={loading || !startActor.trim() || !targetDoctor.trim()}
                            aria-busy={loading}
                            title={(!startActor.trim() || !targetDoctor.trim()) ? "Please enter an actor and select a Doctor to find a connection" : "Find Connection"}
                            className="w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Finding Connection...
                                </>
                            ) : (
                                'Find Connection'
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={resetGame}
                            disabled={loading}
                            className="w-full sm:w-auto px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                        >
                            Reset
                        </button>
                    </div>
                </form>

                {message && (
                    <div className="bg-red-800 bg-opacity-50 p-3 rounded-md mb-6 text-red-200 text-center" role="alert">
                        {message}
                    </div>
                )}

                {connectionPath && (
                    <div className="bg-gray-700 bg-opacity-50 p-5 rounded-lg border border-purple-600 shadow-inner mt-6">
                        <h2 className="text-xl font-semibold text-purple-300 mb-3">Connection Found!</h2>
                        <p className="whitespace-pre-wrap text-purple-100 leading-relaxed">
                            {connectionPath}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
