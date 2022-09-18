/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export var registeredParsers = [];

export class Token {
    constructor(type, code) {
        this.type = type;
        this.code = code;
    }
}

export class Parser {
    constructor(line) {
        this.line = line;
        this.remainingLine = line;
        this.tokens = [];
        this.currentToken = null;
    }

    matchesToken(token, contextAfter = ".*") {
        var matches = this.remainingLine.match(new RegExp(`^(?:${token})`, "sm"));

        if (matches && this.remainingLine.substring(matches[0].length).match(new RegExp(`^(?:${contextAfter})`, "s"))) {
            this.currentToken = matches[0];
            this.remainingLine = this.remainingLine.substring(matches[0].length);

            return true;
        }

        return false;
    }

    addToken(type) {
        this.tokens.push(new Token(type, this.currentToken));
    }

    tokenise() {
        // To be implemented by subclasses; just interpret all as text here
        this.matchesToken(".*");
        this.addToken("text");
    }
}

export function register(parser) {
    this.registeredParsers.push(parser);
}
