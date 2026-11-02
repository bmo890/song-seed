const mockInfo = jest.fn();
jest.mock("../AppAlert", () => ({ AppAlert: { info: (...args: unknown[]) => mockInfo(...args) } }));
jest.mock("../../../design/haptics", () => ({ haptic: { error: jest.fn() } }));
jest.mock("../../../i18n/instance", () => ({
    i18n: { t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key) },
}));

import { reportUnsupportedImports } from "../importFeedback";
import { UnsupportedAudioFormatError } from "../../../services/audioImportFormat";

beforeEach(() => mockInfo.mockClear());

// Audit 11-M2: a CAF on Android, or an Opus voice note on iPhone, is refused when it
// can't be converted. The dialog must name that format, not say "AIFF".
describe("reportUnsupportedImports", () => {
    it("keeps the AIFF wording for AIFF", () => {
        reportUnsupportedImports([{ error: new UnsupportedAudioFormatError("aiff") }]);
        expect(mockInfo).toHaveBeenCalledWith("collectionImport.unsupportedFormatTitle", "collectionImport.unsupportedFormatBody");
    });

    it("names a one-phone format that won't play here", () => {
        reportUnsupportedImports([{ error: new UnsupportedAudioFormatError("opus") }]);
        expect(mockInfo).toHaveBeenCalledWith(
            'collectionImport.formatWontPlayTitle {"format":"OPUS"}',
            "collectionImport.formatWontPlayBody"
        );
    });
});
