export var CardType;
(function (CardType) {
    CardType["DUKE"] = "duke";
    CardType["ASSASSIN"] = "assassin";
    CardType["CAPTAIN"] = "captain";
    CardType["AMBASSADOR"] = "ambassador";
    CardType["CONTESSA"] = "contessa";
})(CardType || (CardType = {}));
export var ActionType;
(function (ActionType) {
    ActionType["INCOME"] = "income";
    ActionType["FOREIGN_AID"] = "foreign_aid";
    ActionType["COUP"] = "coup";
    ActionType["TAX"] = "tax";
    ActionType["ASSASSINATE"] = "assassinate";
    ActionType["STEAL"] = "steal";
    ActionType["EXCHANGE"] = "exchange";
    ActionType["BLOCK"] = "block";
})(ActionType || (ActionType = {}));
export var GamePhase;
(function (GamePhase) {
    GamePhase["WAITING"] = "waiting";
    GamePhase["PLAYING"] = "playing";
    GamePhase["CHALLENGE_PHASE"] = "challenge_phase";
    GamePhase["BLOCK_PHASE"] = "block_phase";
    GamePhase["ENDED"] = "ended";
})(GamePhase || (GamePhase = {}));
export var ResponseType;
(function (ResponseType) {
    ResponseType["CHALLENGE"] = "challenge";
    ResponseType["BLOCK"] = "block";
    ResponseType["ALLOW"] = "allow";
})(ResponseType || (ResponseType = {}));
export var Ruleset;
(function (Ruleset) {
    Ruleset["STANDARD"] = "standard";
    Ruleset["WAUKEGAN"] = "waukegan";
})(Ruleset || (Ruleset = {}));
