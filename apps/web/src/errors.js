import StackTrace from "stacktrace-js";
import {error} from "./redux/error/actions";
import {store} from "./redux/store";
import React from "react";

export function handleError(title, description) {
    store.dispatch(error(title, description));

    const callback = (stackframes) => {
        stackframes.shift(); // Removes first item showing this function.
        const str = stackframes.map((sf) => sf.toString()).join('\n');
        if (isObject(description)) description = JSON.stringify(description);
        console.error(`${title}\n${description}\nStack trace:\n${str}`);
    };

    StackTrace.get().then(callback).catch((err) => console.error(err.message));
}

function isObject(value) {
    return typeof value === 'object' && value !== null;
}

export function handleRequestException(e) {
    const {title, description} = getRequestError(e);
    handleError(title, description);
}

function getRequestError(e) {
    if (e && e.response && e.response.status) {

        // See https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
        const statusCode = e.response.status;

        switch (statusCode) {
            case 400: return {
                title: 'Bad Request',
                description: e.response.data
            };

            case 409: return {
                title: 'Conflict',
                description: e.response.data
            };

            case 500: return {
                title: 'Internal Server Error',
                description: 'The server reported an error. It was not ' +
                    'possible to complete the request at this time.'
            };

            default: return {
                title: `HTTP Error: ${statusCode}`,
                description: e.response.data
            }
        }
    }

    return {
        title: 'Server Request Failed',
        description: 'Unexpected exception error when making the request.'
    }
}

export function getBuildErrorToast(item) {
    if (item.type) {
        return getBuildErrorWasmCommandToast(item);
    } else if (item.line) {
        return getBuildErrorWorkerToast(item);
    }
}

function getBuildErrorWasmCommandToast(item) {
    let isError = false;
    let msg = item.text;

    const errorPrefix = 'ERROR: ';

    if (msg.startsWith(errorPrefix)) {
        isError = true;
        msg = msg.substr(errorPrefix.length);
    }

    if (item.type === 'err') {
        isError = true;
    }

    return {
        severity: isError ? 'error' : 'info',
        sticky: true,
        content: getBuildErrorToastContent(msg, isError)
    };
}

function getBuildErrorWorkerToast(item) {
    let isError = false;
    let msg = item.msg;

    const errorPrefix = 'error: ';

    if (msg.startsWith(errorPrefix)) {
        isError = true;
        msg = msg.substr(errorPrefix.length);
    }

    msg = `Line ${item.line}: ${msg}`;

    return {
        severity: isError ? 'error' : 'info',
        sticky: true,
        content: getBuildErrorToastContent(msg, isError)
    };
}

function getBuildErrorToastContent(msg, isError) {
    return (
        <div className="p-toast-message-text">
            <span className="p-toast-summary">
                Project Run - {isError ? 'Error' : 'Message'}
            </span>
            <div className="p-toast-detail">
                {msg}
            </div>
        </div>
    )
}
