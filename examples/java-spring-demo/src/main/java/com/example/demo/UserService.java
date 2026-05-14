package com.example.demo;

import org.springframework.stereotype.Service;

/**
 * Intentionally smelly service used to demonstrate Rulebound's analyzer
 * orchestration. PMD's <code>SystemPrintln</code> rule and Checkstyle's
 * RegexpSinglelineJava rule both flag the {@code System.out.println} call.
 * SpotBugs picks up the empty catch block (DLS / DE_MIGHT_IGNORE family).
 */
@Service
public class UserService {

    public String greet(String name) {
        // Intentional smell #1: System.out.println in production code.
        System.out.println("greeting " + name);
        return "hello " + name;
    }

    public int parseOrZero(String raw) {
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException ignored) {
            // Intentional smell #2: empty catch block swallows the exception.
        }
        return 0;
    }
}
