import http from "k6/http";
import { check } from "k6";

export const options = {
    vus: 5,
    duration: "10s"
};

export default function () {
    const url = "http://localhost:5056/api/test";

    const params = {
        headers: {
            Authorization: `Bearer ${__ENV.JWT_TOKEN}`
        }
    };

    const response = http.get(url, params);

    check(response, {
        "status is 200 or 429": (r) =>
            r.status === 200 || r.status === 429
    });
}