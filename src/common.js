/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export function compareObjects(a, b) {
    console.log(a, b, JSON.stringify(a) == JSON.stringify(b));
    return JSON.stringify(a) == JSON.stringify(b);
}