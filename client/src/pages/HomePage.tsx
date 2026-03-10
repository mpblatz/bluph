import { Link } from "react-router-dom";

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-16 px-4">
            <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
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

                {/* About */}
                <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-6 flex flex-col gap-2">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">About</p>
                    <p className="text-sm text-gray-300 leading-relaxed">
                        Bluph is a fan-made online adaptation of <span className="text-white font-medium">Coup</span>,
                        the social deduction card game by La Mame Games. It is not affiliated with or endorsed by the
                        original creators. All credit for the core game concept goes to them, this is just a way to play
                        with friends online.
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed">
                        In Coup, each player starts with two hidden influence cards and two coins. On your turn you can
                        take coins or use your cards' abilities, but you can claim any card whether you have it or not.
                        Other players can challenge you or block you. Lose both your influence cards and you're
                        eliminated. Last one standing wins.
                    </p>
                </div>

                {/* Standard Rules */}
                <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-6 flex flex-col gap-4">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Standard Rules</p>
                    <div className="grid grid-cols-1 gap-3">
                        {[
                            { name: "Income", desc: "Take 1 coin. Cannot be blocked or challenged." },
                            { name: "Foreign Aid", desc: "Take 2 coins. Can be blocked by the Duke." },
                            {
                                name: "Coup",
                                desc: "Pay 7 coins to eliminate one of a player's influence cards. Mandatory at 10+ coins.",
                            },
                            { name: "Tax (Duke)", desc: "Take 3 coins. Can be challenged." },
                            {
                                name: "Steal (Captain)",
                                desc: "Take 2 coins from another player. Can be blocked by Ambassador or Captain. Can be challenged.",
                            },
                            {
                                name: "Assassinate (Assassin)",
                                desc: "Pay 3 coins to eliminate one of a target's influence cards. Can be blocked by Contessa. Can be challenged.",
                            },
                            {
                                name: "Exchange (Ambassador)",
                                desc: "Draw 2 cards from the deck, keep any you want, return the rest. Can be challenged.",
                            },
                            {
                                name: "Block (Contessa)",
                                desc: "Block an assassination attempt against you. Can be challenged.",
                            },
                        ].map((action) => (
                            <div key={action.name} className="flex gap-3">
                                <span className="text-white font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                    {action.name}
                                </span>
                                <span className="text-gray-400 text-sm leading-relaxed">{action.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Waukegan Rules */}
                <div className="w-full bg-gray-900 border border-yellow-900/50 rounded-lg p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Waukegan Rules</p>
                        <span className="text-xs font-semibold bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-2 py-0.5 rounded">
                            Variant
                        </span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        A house variant with extra mechanics. All standard rules apply unless noted.
                    </p>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <span className="text-white font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                Coin Cap
                            </span>
                            <span className="text-gray-400 text-sm leading-relaxed">
                                Maximum 12 coins. Income and Foreign Aid are blocked at 10+. No forced Coup.
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-white font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                Double Claims
                            </span>
                            <span className="text-gray-400 text-sm leading-relaxed">
                                On your turn you can claim to have two of the same card for a powered-up effect.
                                Challenging requires proving you actually hold both.
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-yellow-400 font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                Double Duke
                            </span>
                            <span className="text-gray-400 text-sm leading-relaxed">Take 5 coins instead of 3.</span>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-yellow-400 font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                Double Captain
                            </span>
                            <span className="text-gray-400 text-sm leading-relaxed">
                                Steal 3 coins. Cannot be blocked.
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-yellow-400 font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                Double Ambassador
                            </span>
                            <span className="text-gray-400 text-sm leading-relaxed">
                                Draw 3 cards from the deck instead of 2.
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-yellow-400 font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                Double Assassin
                            </span>
                            <span className="text-gray-400 text-sm leading-relaxed">
                                The target cannot block with a single Contessa. Requires Double Contessa to block.
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-yellow-400 font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                Double Contessa
                            </span>
                            <span className="text-gray-400 text-sm leading-relaxed">
                                Redirect an assassination to another player instead of blocking it outright.
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-white font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                Targeted Coup
                            </span>
                            <span className="text-gray-400 text-sm leading-relaxed">
                                When you Coup, choose a specific card type to remove. If the target has it, that card is
                                eliminated. If not, your 7 coins are wasted.
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <span className="text-red-400 font-semibold text-sm whitespace-nowrap w-36 shrink-0">
                                Dylan's Gambit
                            </span>
                            <span className="text-gray-400 text-sm leading-relaxed">
                                If you bluff a Contessa block against an assassination and are caught (challenged and
                                proven wrong), you lose <span className="text-white font-medium">all</span> your
                                influence cards immediately. Instant elimination.
                            </span>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-gray-600 text-center pb-4">
                    Bluph is an unofficial fan project. Coup is a registered trademark of La Mame Games.
                </p>
            </div>
        </div>
    );
}
