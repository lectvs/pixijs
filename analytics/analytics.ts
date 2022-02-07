namespace Analytics {
    type ProfileData = {
        profileId: string;
        totalPlayTime: number;
    } & Dict<any>;

    type SessionData = {
        profileId: string;
        startTime: number;
        playTime: number;
    } & Dict<any>;

    type RegisteredUpdater<T> = {
        update: (updateFn: (currentValue: T) => T) => void;
    }

    type RegisteredSubmitter<T> = {
        get: Getter<T>;
    }

    export const profileData: ProfileData = {
        profileId: '',
        totalPlayTime: 0,
    };

    export const sessionData: SessionData = {
        profileId: '',
        startTime: 0,
        playTime: 0,
    };

    const registeredUpdaters: Dict<RegisteredUpdater<any>> = {};
    const registeredSubmitters: Dict<RegisteredSubmitter<any>> = {};

    var submitTimer: Timer;

    export function init() {
        let now = Date.now();
        profileData.profileId = `${now}_${new UIDGenerator().generate()}`;
        profileData.totalPlayTime = 0;

        let loadedData = load();
        if (loadedData) {
            for (let key in loadedData) {
                profileData[key] = loadedData[key];
            }
        }

        sessionData.profileId = profileData.profileId;
        sessionData.startTime = now;
        sessionData.playTime = 0;

        submitTimer = new Timer(300, () => submit(), Infinity);
    }

    export function update(delta: number) {
        profileData.totalPlayTime += delta;
        sessionData.playTime += delta;

        submitTimer.update(delta);
    }

    export function submit() {
        for (let key in registeredSubmitters) {
            let value = registeredSubmitters[key].get();
            profileData[key] = value;
            sessionData[key] = value;
        }

        save();

        let profileEncoded = encodeURIComponent(St.encodeB64S(JSON.stringify(profileData)));
        let sessionEncoded = encodeURIComponent(St.encodeB64S(JSON.stringify(sessionData)));
        Network.httpRequest(`${LAMBDA_URL}?operation=submit&game=${global.gameCodeName}&profile=${profileEncoded}&session=${sessionEncoded}`, null, (responseJson: any, err: string) => {
            if (err) error(err);
        });
    }

    export function registerUpdater<T>(key: string, initialValue: T): RegisteredUpdater<T> {
        if (key in registeredUpdaters) {
            error(`Analytic Updater '${key}' has already been registered`);
            return registeredUpdaters[key];
        }

        let registeredUpdater: RegisteredUpdater<T> = {
            update: (updateFn: (currentValue: T) => T) => {
                profileData[key] = updateFn(<T>profileData[key]);
                sessionData[key] = updateFn(<T>sessionData[key]);
            },
        };

        registeredUpdaters[key] = registeredUpdater;
        profileData[key] = profileData[key] ?? initialValue;
        sessionData[key] = sessionData[key] ?? initialValue;
        
        return registeredUpdater;
    }

    export function registerSubmitter<T>(key: string, get: Getter<T>) {
        if (key in registeredSubmitters) {
            error(`Analytic Submitter '${key}' has already been registered`);
            return;
        }

        let registeredSubmitter: RegisteredSubmitter<T> = {
            get: get,
        };

        registeredSubmitters[key] = registeredSubmitter;
    }

    function load() {
        try {
            let encoded = LocalStorage.getString(`${global.gameCodeName}_analytics`);
            return <ProfileData>JSON.parse(St.decodeB64S(encoded));
        } catch {
            return undefined;
        }
    }

    function save() {
        let encoded = St.encodeB64S(JSON.stringify(profileData));
        LocalStorage.setString(`${global.gameCodeName}_analytics`, encoded);
    }

    const LAMBDA_URL = 'https://do3edgzm3f.execute-api.us-east-2.amazonaws.com/default/analytics';
}