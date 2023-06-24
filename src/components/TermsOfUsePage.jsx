import React, {useEffect} from "react";
import {useDispatch, useSelector} from "react-redux";
import ReactMarkdown from "react-markdown";
import {Titled} from "react-titled";
import {Card} from "primereact/card";
import {requestTermsOfUse} from "../redux/app/actions";
import {sep} from "../constants";

export default function InfoLegacyTerms() {
    const dispatch = useDispatch();

    const text = useSelector(state => state?.app.termsOfUse);

    useEffect(() => {
        if (!text) {
            dispatch(requestTermsOfUse());
        }
    }, []);

    return (
        <Titled title={(s) => `Terms of Use ${sep} ${s}`}>
            <Card className="m-2">
                <ReactMarkdown>
                    {text}
                </ReactMarkdown>
            </Card>
        </Titled>
    )
}
