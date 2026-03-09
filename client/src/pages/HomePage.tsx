import { Link } from "react-router-dom";

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-8">
                <div className="text-center">
                    <h1 className="text-8xl font-bold tracking-tight text-white">bluph</h1>
                    <p className="mt-3 text-gray-400 text-sm tracking-widest uppercase">A game of deception</p>
                </div>

                <div className="flex gap-3">
                    <Link
                        to="/create"
                        className="bg-white text-gray-950 font-semibold px-6 py-2.5 rounded hover:bg-gray-200 transition-colors text-sm"
                    >
                        Create Game
                    </Link>
                    <Link
                        to="/join"
                        className="bg-gray-800 text-white font-semibold px-6 py-2.5 rounded hover:bg-gray-700 border border-gray-700 transition-colors text-sm"
                    >
                        Join Game
                    </Link>
                </div>
            </div>
        </div>
    );
}
