#!/bin/sh
cbranch=$(git symbolic-ref --short HEAD)
open "https://github.aus.thenational.com/Podium/SalesForce/compare/$1...$cbranch"