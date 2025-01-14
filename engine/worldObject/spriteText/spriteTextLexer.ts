namespace SpriteTextLexer {
    export type Lexeme = {
        type: 'word';
        chars: Char[];
    } | {
        type: 'space';
        count: number;
    } | {
        type: 'newline';
        count: number;
    }

    export type Char = {
        name: string;
        isCustom: boolean;
        /**
         * From outermost tag -> innermost tag.
         */
        tagData: SpriteText.TagData[];
        position: number;
    }

    export function lex(tokens: SpriteTextTokenizer.Token[], wordWrap: boolean) {
        return combineWords(hydrateTagData(tokens), wordWrap);
    }

    function combineWords(inputLexemes: Lexeme[], wordWrap: boolean) {
        if (A.isEmpty(inputLexemes)) return [];

        let lexemes: Lexeme[] = [];
        let currentLexeme: Lexeme = O.deepClone(inputLexemes[0]);

        for (let i = 1; i < inputLexemes.length; i++) {
            let lexeme = inputLexemes[i];

            if (lexeme.type === 'word') {
                if (currentLexeme.type !== 'word' || !wordWrap) {
                    lexemes.push(currentLexeme);
                    currentLexeme = O.deepClone(lexeme);
                } else {
                    currentLexeme.chars.push(...lexeme.chars);
                }
                continue;
            }

            if (lexeme.type === 'space') {
                if (currentLexeme.type !== 'space') {
                    lexemes.push(currentLexeme);
                    currentLexeme = O.deepClone(lexeme);
                } else {
                    currentLexeme.count += lexeme.count;
                }
                continue;
            }

            if (lexeme.type === 'newline') {
                if (currentLexeme.type !== 'newline') {
                    lexemes.push(currentLexeme);
                    currentLexeme = O.deepClone(lexeme);
                } else {
                    currentLexeme.count += lexeme.count;
                }
                continue;
            }

            assertUnreachable(lexeme);
        }

        lexemes.push(currentLexeme);

        return lexemes;
    }

    function hydrateTagData(tokens: SpriteTextTokenizer.Token[]) {
        let lexemes: Lexeme[] = [];
        let tagData: SpriteText.TagData[] = [];
        let currentPart = 0;
        let currentLexemePosition = 0;

        for (let token of tokens) {
            if (token.type === 'starttag') {
                tagData.push({ tag: token.tag, params: token.params });
                currentPart++;
                continue;
            }

            if (token.type === 'endtag') {
                if (A.isEmpty(tagData)) {
                    console.error('Text has end-tag that is not closing anything');
                    continue;
                }
                tagData.pop();
                currentPart++;
                continue;
            }

            if (token.type === 'space') {
                lexemes.push({ type: 'space', count: 1 });
                currentLexemePosition++;
                continue;
            }

            if (token.type === 'newline') {
                lexemes.push({ type: 'newline', count: 1 });
                currentPart++;
                continue;
            }

            if (token.type === 'char' || token.type === 'customchar') {
                let char: Char = {
                    name: token.name,
                    isCustom: token.type === 'customchar',
                    tagData: A.clone(tagData),
                    position: currentLexemePosition,
                };
                lexemes.push({ type: 'word', chars: [char] });
                currentLexemePosition++;
                continue;
            }

            assertUnreachable(token);
        }

        return lexemes;
    }
}