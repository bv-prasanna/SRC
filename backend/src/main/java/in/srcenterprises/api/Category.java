package in.srcenterprises.api;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
@Entity @Table(name="categories")
public class Category {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @NotBlank @Size(max=100) @Column(nullable=false,unique=true) public String name;
 @Size(max=10) public String icon;
 @NotNull public Boolean published=true;
 @Version public Long version;
}